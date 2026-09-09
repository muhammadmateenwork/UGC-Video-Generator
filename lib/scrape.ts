import * as cheerio from "cheerio";

export interface ScrapedProduct {
  url: string;
  domain: string;
  title: string;
  description: string;
  bodyText: string;
  imageUrl: string | null;
}

const FETCH_TIMEOUT_MS = 12000;
const MAX_BODY_CHARS = 2000;

/** Adds https:// if the user typed a bare domain like "calai.app". */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function absolutize(maybeRelative: string | undefined, base: string): string | null {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

/**
 * Scrapes a product URL for the signals Gemini needs to plan a creative:
 * title, description, a chunk of visible body text, and a hero image.
 * Never throws — a fetch/parse failure degrades to a domain-only stub so a
 * bad scrape doesn't take down the whole render pipeline.
 */
export async function scrapeProduct(rawUrl: string): Promise<ScrapedProduct> {
  const url = normalizeUrl(rawUrl);
  const domain = new URL(url).hostname.replace(/^www\./, "");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || !contentType.includes("text/html")) {
      return { url, domain, title: domain, description: "", bodyText: "", imageUrl: null };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr("content")?.trim() ||
      $("title").first().text().trim() ||
      domain;

    const description =
      $('meta[property="og:description"]').attr("content")?.trim() ||
      $('meta[name="description"]').attr("content")?.trim() ||
      "";

    const imageUrl =
      absolutize($('meta[property="og:image"]').attr("content"), url) ||
      absolutize($('link[rel="icon"]').attr("href"), url);

    $("script, style, noscript, svg").remove();
    const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, MAX_BODY_CHARS);

    return { url, domain, title, description, bodyText, imageUrl };
  } catch {
    return { url, domain, title: domain, description: "", bodyText: "", imageUrl: null };
  }
}
