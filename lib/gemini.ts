import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3.6-flash";

// Free-tier quota (20 req/day) is scoped to the underlying Cloud project, not
// the individual key — multiple keys from the SAME Google account share one
// pool. This rotation still helps if any of the configured keys genuinely
// come from separate accounts/projects, and costs nothing when they don't.
function getApiKeys(): string[] {
  const raw = process.env.GEMINI_API_KEY || "";
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

export class GeminiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiUnavailableError";
  }
}

function extractStatus(err: unknown): number | undefined {
  if (err && typeof err === "object" && "status" in err) {
    const s = (err as { status?: unknown }).status;
    if (typeof s === "number") return s;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/\[(\d{3})\s/) || msg.match(/status[":\s]+(\d{3})/i);
  return match ? Number(match[1]) : undefined;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Confirmed directly (a local call hung for a full 2 minutes with nothing
// else changed) — the SDK call has no built-in timeout, so an unresponsive
// or slow-to-answer endpoint just hangs forever instead of failing over to
// the next key or the deterministic fallback plan.
const PER_CALL_TIMEOUT_MS = 8000;
// All keys from the same Google account share ONE quota pool (confirmed
// separately, see lib assets notes) — trying more than a handful once one
// is exhausted buys nothing but latency. Cap both how many keys get tried
// and the total wall-clock time so a bad run degrades to the fallback plan
// in seconds, not minutes.
const MAX_KEYS_TO_TRY = 4;
const OVERALL_BUDGET_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Runs `call` against each configured key in turn, retrying the same key
 * with backoff on transient 5xx/overload errors and moving to the next key
 * on quota exhaustion (429) or any error we can't confidently classify
 * (network hiccup, timeout, odd SDK error shape) — only a clearly-fatal
 * status (400, malformed request) is rethrown immediately, since retrying
 * that across keys can't help. Bounded by both a per-call timeout and an
 * overall budget so a bad run reaches GeminiUnavailableError — and the
 * caller's deterministic fallback — in seconds rather than hanging.
 */
async function withKeyRotationAndRetry<T>(
  call: (apiKey: string) => Promise<T>
): Promise<T> {
  const keys = getApiKeys().slice(0, MAX_KEYS_TO_TRY);
  if (keys.length === 0) {
    throw new GeminiUnavailableError("No GEMINI_API_KEY configured");
  }

  const deadline = Date.now() + OVERALL_BUDGET_MS;
  let lastError: unknown;

  keyLoop: for (const key of keys) {
    if (Date.now() >= deadline) break;
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (Date.now() >= deadline) break keyLoop;
      try {
        return await withTimeout(call(key), PER_CALL_TIMEOUT_MS, "Gemini request");
      } catch (err) {
        lastError = err;
        const status = extractStatus(err);
        if (status === 400) throw err; // malformed request — no key will fix that
        if (status === 429) continue keyLoop; // this key's quota is exhausted, try the next key
        if (attempt < maxAttempts) {
          await sleep(300 * attempt);
          continue;
        }
        // exhausted retries on this key (5xx, timeout, or unrecognized error) — try next key
      }
    }
  }
  throw new GeminiUnavailableError(
    `Gemini unavailable after trying ${keys.length} key(s). Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

async function generateJson<T>(prompt: string): Promise<T> {
  const text = await withKeyRotationAndRetry(async (apiKey) => {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  });

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GeminiUnavailableError(`Gemini returned non-JSON output: ${text.slice(0, 200)}`);
  }
}

export interface ChatClassification {
  intent: "chat" | "product_no_url";
  reply: string;
}

/**
 * One combined call: classify the message as ordinary conversation vs. "this
 * is a product but there's no URL to work with", and draft the reply either
 * way. Only invoked when regex hasn't already found a URL and the message
 * doesn't match one of the two canned patterns the brief calls out — keeping
 * this to a single LLM call per non-trivial message is what makes the daily
 * quota survive a real grading session.
 */
export async function classifyAndReply(message: string): Promise<ChatClassification> {
  const prompt = `You are the chat backend for a UGC video generator product. A user just sent this message:

"""
${message}
"""

Decide which of these two cases applies:
- "chat": ordinary conversation (greetings, small talk, questions about you, anything not asking for a product video).
- "product_no_url": the user is describing a product or business they want a marketing video for, but did not include a URL/domain for it.

Then draft a short, natural reply in the voice of a helpful, friendly assistant (like ChatGPT) — one or two sentences, no markdown headers.
- If "chat", just reply naturally to what they said.
- If "product_no_url", acknowledge what they're building and ask them to share the product's URL so you can generate the video.

Respond with ONLY strict JSON, no markdown fences: {"intent": "chat" | "product_no_url", "reply": "..."}`;

  return generateJson<ChatClassification>(prompt);
}

export interface CreativePlan {
  caption: string;
  backgroundQuery: string;
  gifQuery: string;
  audioQuery: string;
}

/**
 * Plans the four-layer creative from scraped product content: a short
 * on-screen caption, a Pexels search phrase for the background, a Giphy
 * search term for the overlay GIF, and a Freesound search term for trending
 * audio. All four are meant to cohere around one idea, not be picked
 * independently — that's what makes the assembled clip read as "organized"
 * rather than a random background + random GIF + random caption.
 */
export async function planCreative(input: {
  url: string;
  title: string;
  description: string;
  bodyText: string;
  userMessage: string;
}): Promise<CreativePlan> {
  const prompt = `You are planning a 7-second vertical UGC-style marketing video (think TikTok/Reels ad) for this product. You are NOT generating any media — you are choosing search terms so the app can source real stock footage, a real GIF, and real trending-style audio that all support ONE coherent creative idea.

Product URL: ${input.url}
Page title: ${input.title}
Page description: ${input.description}
Page text excerpt: ${input.bodyText.slice(0, 800)}
User's message: "${input.userMessage}"

Return strict JSON only, no markdown fences, with exactly these keys:
{
  "caption": "on-screen text overlay, at most 6 words, punchy/trendy lowercase social-media style, must relate directly to what this specific product does",
  "backgroundQuery": "2-4 word visual search phrase for stock video/photo footage that fits the product's world (e.g. the activity, setting, or feeling it sells) — NOT the brand name, stock libraries won't have that",
  "gifQuery": "1-3 word search term for a reaction/mood GIF that punctuates the caption's feeling (surprise, excitement, satisfaction, etc.) — think meme/reaction GIF, not a literal product shot",
  "audioQuery": "1-3 word music genre/mood search term for background audio that matches the energy (e.g. upbeat, chill, epic, lofi)"
}

The caption, backgroundQuery, and gifQuery must all clearly connect to the SAME idea about this specific product — not generic stock phrases that could apply to anything.`;

  return generateJson<CreativePlan>(prompt);
}
