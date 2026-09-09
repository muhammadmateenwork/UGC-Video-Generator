import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Stores an assembled clip and returns a fetchable URL.
 *
 * On Vercel (`process.env.VERCEL` is set automatically in every Vercel
 * environment), uploads to Vercel Blob so the URL survives across
 * serverless invocations and redeploys. Locally, writes into
 * public/generated/ and returns a same-origin path Next.js serves directly
 * — no separate storage service needed for `next dev`.
 */
export async function storeVideo(buffer: Buffer): Promise<string> {
  const filename = `${randomUUID()}.mp4`;

  if (process.env.VERCEL) {
    const { put } = await import("@vercel/blob");
    const blob = await put(filename, buffer, {
      access: "public",
      contentType: "video/mp4",
    });
    return blob.url;
  }

  const dir = path.join(process.cwd(), "public", "generated");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buffer);
  return `/generated/${filename}`;
}
