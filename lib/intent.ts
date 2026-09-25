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
