// A deliberately conservative bare-domain/URL matcher: full http(s) URLs
// always match; a bare domain like "calai.app" matches only if every label
// is alphanumeric and the TLD is 2-24 letters, so things like "e.g." or
// "gpt-4.5" don't get misread as a site to scrape.
const FULL_URL_RE = /\bhttps?:\/\/[^\s<>"')]+/i;
const BARE_DOMAIN_RE =
  /(?<![\w@])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?:\/[^\s<>"')]*)?(?![\w-])/i;

/** Extracts the first URL/domain mentioned in a message, if any. */
export function extractUrl(message: string): string | null {
  const full = message.match(FULL_URL_RE);
  if (full) return full[0];
  const bare = message.match(BARE_DOMAIN_RE);
  return bare ? bare[0] : null;
}

const GREETING_RE = /^\s*(hi|hello|hey|yo|sup|hiya|good (morning|afternoon|evening))[\s!.,]*$/i;
const CAPABILITIES_RE =
  /what (can|do) you do|what are you|who are you|how does this work|help\b/i;

export type CannedIntent = "greeting" | "capabilities" | null;

/** Matches the brief's two exact conversational examples (plus close variants) so they never spend an LLM call. */
export function matchCannedIntent(message: string): CannedIntent {
  const trimmed = message.trim();
  if (GREETING_RE.test(trimmed)) return "greeting";
  if (CAPABILITIES_RE.test(trimmed)) return "capabilities";
  return null;
}

export const CANNED_REPLIES: Record<Exclude<CannedIntent, null>, string> = {
  greeting: "Hey! I'm ready when you are — send me a product URL and I'll put together a short UGC-style marketing video for it.",
  capabilities:
    "I can generate UGC videos for you — just send me a product URL and I'll create a short marketing video for it, picking a background, GIF, trending audio, and caption that all fit the product.",
};
