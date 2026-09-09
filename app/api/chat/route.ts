import { extractUrl, matchCannedIntent, CANNED_REPLIES } from "@/lib/intent";
import { scrapeProduct } from "@/lib/scrape";
import { classifyAndReply, planCreative, GeminiUnavailableError, type CreativePlan } from "@/lib/gemini";
import { sourceBackground, sourceGif, sourceAudio } from "@/lib/assets";
import { assembleUgcClip } from "@/lib/assemble";
import { storeVideo } from "@/lib/storage";
import type { ChatStreamEvent } from "@/lib/types";

// ffmpeg needs a real Node.js process, not the Edge runtime.
export const runtime = "nodejs";
// Scrape + Gemini + 3 parallel asset fetches + ffmpeg encode can take a
// while; give it the room Vercel Hobby allows rather than the 10s default.
export const maxDuration = 60;

const MAX_MESSAGE_LENGTH = 2000;

function sseEncode(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Splits text into small chunks so the client can render it as if typed. */
function* tokenize(text: string): Generator<string> {
  const parts = text.match(/\S+\s*/g) ?? [text];
  for (const part of parts) yield part;
}

/** Deterministic creative plan used only if Gemini is genuinely unavailable
 * (quota exhausted, missing key, bad JSON) — keeps the pipeline able to
 * render *something* coherent rather than failing the whole request. */
function fallbackCreativePlan(title: string, domain: string): CreativePlan {
  return {
    caption: `check out ${title || domain}`,
    backgroundQuery: "modern lifestyle",
    gifQuery: "mind blown",
    audioQuery: "upbeat",
  };
}

export async function POST(req: Request) {
  let body: { message?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return new Response("Missing message", { status: 400 });
  if (message.length > MAX_MESSAGE_LENGTH) {
    return new Response("Message too long", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => controller.enqueue(encoder.encode(sseEncode(event)));
      const sendText = async (text: string) => {
        for (const chunk of tokenize(text)) {
          send({ type: "token", text: chunk });
          // A small delay makes the streamed reply readable instead of
          // arriving as one instant flash of text.
          await new Promise((r) => setTimeout(r, 12));
        }
      };

      try {
        const url = extractUrl(message);

        if (url) {
          await handleProductFlow(url, message, send, sendText);
        } else {
          const canned = matchCannedIntent(message);
          if (canned) {
            await sendText(CANNED_REPLIES[canned]);
          } else {
            try {
              const classification = await classifyAndReply(message);
              await sendText(classification.reply);
            } catch (err) {
              if (err instanceof GeminiUnavailableError) {
                await sendText(
                  "I'm a little over my AI quota for the moment, but I'm still here — send me a product URL and I'll generate a video for it."
                );
              } else {
                throw err;
              }
            }
          }
        }

        send({ type: "done" });
      } catch (err) {
        send({ type: "error", text: err instanceof Error ? err.message : "Something went wrong." });
        send({ type: "done" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

async function handleProductFlow(
  url: string,
  userMessage: string,
  send: (e: ChatStreamEvent) => void,
  sendText: (text: string) => Promise<void>
) {
  send({ type: "status", text: "Reading the page...", stage: "scrape" });
  const scraped = await scrapeProduct(url);

  send({ type: "status", text: "Planning the creative...", stage: "plan" });
  let plan: CreativePlan;
  try {
    plan = await planCreative({
      url: scraped.url,
      title: scraped.title,
      description: scraped.description,
      bodyText: scraped.bodyText,
      userMessage,
    });
  } catch (err) {
    if (err instanceof GeminiUnavailableError) {
      plan = fallbackCreativePlan(scraped.title, scraped.domain);
    } else {
      throw err;
    }
  }

  send({ type: "status", text: "Sourcing background, GIF, and audio...", stage: "source" });
  const [backgroundResult, gifResult, audioResult] = await Promise.allSettled([
    sourceBackground(plan.backgroundQuery),
    sourceGif(plan.gifQuery),
    sourceAudio(plan.audioQuery),
  ]);

  const background = backgroundResult.status === "fulfilled" ? backgroundResult.value : null;
  const gifBuffer = gifResult.status === "fulfilled" ? gifResult.value : null;
  const audioBuffer = audioResult.status === "fulfilled" ? audioResult.value : null;

  send({ type: "status", text: "Rendering your video...", stage: "render" });
  const clip = await assembleUgcClip({
    background,
    gifBuffer,
    audioBuffer,
    caption: plan.caption,
  });

  send({ type: "status", text: "Uploading...", stage: "upload" });
  const videoUrl = await storeVideo(clip);

  await sendText(`Here's your UGC video for ${scraped.title || scraped.domain}:`);
  send({ type: "video", url: videoUrl });
}
