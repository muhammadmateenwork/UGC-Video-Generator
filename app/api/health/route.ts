import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const run = promisify(execFile);
const ENV = ["DATABASE_URL", "BLOB_READ_WRITE_TOKEN", "GEMINI_API_KEY", "PEXELS_API_KEY", "GIPHY_API_KEY", "FREESOUND_API_KEY"];

/**
 * GET /api/health — what the deployed server can actually do: whether the
 * ffmpeg binary exists and runs, which env vars are set (booleans only —
 * never values), and whether the database answers. Added after a render
 * that worked locally failed only on Vercel, where there's no shell to look.
 */
export async function GET() {
  const ffmpeg: Record<string, unknown> = { path: ffmpegPath, exists: !!ffmpegPath && existsSync(ffmpegPath) };
  if (ffmpeg.exists) {
    try {
      const { stdout } = await run(ffmpegPath!, ["-version"], { timeout: 10_000 });
      ffmpeg.version = stdout.split("\n")[0];
    } catch (err) {
      ffmpeg.error = err instanceof Error ? err.message.slice(0, 300) : String(err);
    }
  }

  let database: string;
  try {
    await db().execute(sql`select 1`);
    database = "ok";
  } catch (err) {
    database = err instanceof Error ? err.message.slice(0, 200) : "error";
  }

  const env = Object.fromEntries(ENV.map((k) => [k, !!process.env[k]]));
  // Blob storage is only used on Vercel; locally videos go to public/generated.
  const required = ENV.filter((k) => k !== "BLOB_READ_WRITE_TOKEN" || process.env.VERCEL);
  const ok = ffmpeg.version !== undefined && database === "ok" && required.every((k) => env[k]);
  return Response.json(
    { ok, ffmpeg, database, env, onVercel: !!process.env.VERCEL },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
