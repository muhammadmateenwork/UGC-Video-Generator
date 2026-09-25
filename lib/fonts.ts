import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Fonts for server-side image rendering (the caption burned into each MP4
 * and the share-card images). next/og only bundles one regular-weight
 * face, and Satori reads woff/ttf but not woff2, so the exact faces the
 * site uses are vendored under assets/fonts (OFL, licences alongside).
 */
const FILES = {
  interExtraBold: "Inter-ExtraBold.woff",
  instrumentSerif: "InstrumentSerif-Regular.woff",
} as const;

const cache = new Map<keyof typeof FILES, Promise<Buffer>>();

export function loadFont(name: keyof typeof FILES): Promise<Buffer> {
  let p = cache.get(name);
  if (!p) {
    p = readFile(path.join(process.cwd(), "assets", "fonts", FILES[name]));
    cache.set(name, p);
  }
  return p;
}
