import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import ffmpegPath from "ffmpeg-static";

const run = promisify(execFile);

const FPS = 30;
const WIDTH = 720;
const HEIGHT = 1280;
// A GIF this wide, centered, used to sit directly on top of the background's
// main subject (e.g. covering the product itself) instead of reading as a
// reaction accent. Sized and corner-anchored instead, closer to how real
// UGC edits place a reaction GIF without blocking the shot underneath it.
const GIF_WIDTH = 250;
const CLIP_DURATION = 7;
const FADE_SECONDS = 0.4;
// Ink brand color from the app's own palette, used as a fallback background
// if no stock asset could be sourced at all — never leaves the user with a
// failed render just because Pexels had nothing for an unusual query.
const FALLBACK_BG_COLOR = "0x18181b";

export interface UgcClipInput {
  /** null means no background asset was sourced — falls back to a solid brand-color canvas. */
  background: { type: "video" | "image"; buffer: Buffer } | null;
  gifBuffer: Buffer | null;
  audioBuffer: Buffer | null;
  caption: string;
  durationSeconds?: number;
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "’")
    .replace(/%/g, "\\%");
}

/** Wraps caption text onto at most 2 lines so it never overflows the frame width. */
function wrapCaption(text: string, maxCharsPerLine = 20): string {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2).join("\n");
}

/**
 * Assembles the four-layer UGC clip — background, trendy caption, trending
 * audio, and a GIF overlay — as one ffmpeg filter_complex pass.
 *
 * Every filter stage writes to an explicitly named pad and the *last*
 * statement always relabels whatever the current stage is to `[vout]` via a
 * no-op `null` filter. This is deliberate: a previous version of this
 * pipeline had a real bug where the no-GIF branch reused a pad label with a
 * bare comma instead of an explicit `;`-separated statement, and ffmpeg
 * rejected it. Building the graph as a list of fully self-contained
 * statements (never string-splicing partial filter chains together) makes
 * that class of bug structurally impossible instead of just fixed once.
 */
export async function assembleUgcClip(input: UgcClipInput): Promise<Buffer> {
  if (!ffmpegPath) throw new Error("ffmpeg-static binary not found");
  const duration = input.durationSeconds ?? CLIP_DURATION;
  const caption = input.caption?.trim() || "";

  const jobDir = await fs.mkdtemp(path.join(os.tmpdir(), "ugc-"));
  try {
    const args: string[] = ["-y"];

    // --- Input 0: background ---
    if (input.background) {
      const bgExt = input.background.type === "video" ? "bg.mp4" : "bg.jpg";
      const bgPath = path.join(jobDir, bgExt);
      await fs.writeFile(bgPath, input.background.buffer);
      if (input.background.type === "video") {
        args.push("-stream_loop", "-1", "-i", bgPath);
      } else {
        args.push("-loop", "1", "-i", bgPath);
      }
    } else {
      args.push(
        "-f",
        "lavfi",
        "-i",
        `color=c=${FALLBACK_BG_COLOR}:s=${WIDTH}x${HEIGHT}:r=${FPS}`
      );
    }

    // --- Input 1 (optional): GIF overlay ---
    let gifInputIndex: number | null = null;
    if (input.gifBuffer) {
      const gifPath = path.join(jobDir, "overlay.gif");
      await fs.writeFile(gifPath, input.gifBuffer);
      gifInputIndex = 1;
      args.push("-stream_loop", "-1", "-i", gifPath);
    }

    // --- Next input: trending audio, or a silent track so output audio is consistent ---
    const audioInputIndex = gifInputIndex !== null ? 2 : 1;
    if (input.audioBuffer) {
      const audioPath = path.join(jobDir, "audio.mp3");
      await fs.writeFile(audioPath, input.audioBuffer);
      args.push("-stream_loop", "-1", "-i", audioPath);
    } else {
      args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
    }

    // --- Build the video filter graph as fully self-contained statements ---
    const filters: string[] = [];
    filters.push(
      `[0:v]scale=w=${WIDTH}:h=${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},setsar=1,fps=${FPS}[bg]`
    );
    let pad = "bg";

    if (caption) {
      const text = escapeDrawtext(wrapCaption(caption));
      filters.push(
        `[${pad}]drawtext=text='${text}':fontcolor=white:fontsize=48:line_spacing=8:` +
          `box=1:boxcolor=black@0.45:boxborderw=18:` +
          `x=(w-text_w)/2:y=110[cap]`
      );
      pad = "cap";
    }

    if (gifInputIndex !== null) {
      const gifStart = duration * 0.12;
      const gifEnd = duration * 0.78;
      filters.push(`[${gifInputIndex}:v]scale=${GIF_WIDTH}:-1[gifscaled]`);
      // Bottom-right corner, not dead center — leaves the background's main
      // subject fully visible instead of the GIF sitting on top of it.
      filters.push(
        `[${pad}][gifscaled]overlay=x=W-w-28:y=H*0.60:format=auto:` +
          `enable='between(t\\,${gifStart.toFixed(2)}\\,${gifEnd.toFixed(2)})'[withgif]`
      );
      pad = "withgif";
    }

    // Fade the whole composite in/out — cheap polish that makes the clip read
    // as edited rather than a raw asset dump.
    filters.push(
      `[${pad}]fade=t=in:st=0:d=${FADE_SECONDS},fade=t=out:st=${(duration - FADE_SECONDS).toFixed(
        2
      )}:d=${FADE_SECONDS}[faded]`
    );
    pad = "faded";

    // Explicit final relabel — see the doc comment above for why this exists
    // regardless of which branches above ran.
    filters.push(`[${pad}]null[vout]`);

    const audioFilter =
      `[${audioInputIndex}:a]afade=t=in:st=0:d=${FADE_SECONDS},` +
      `afade=t=out:st=${(duration - FADE_SECONDS).toFixed(2)}:d=${FADE_SECONDS}[aout]`;
    filters.push(audioFilter);

    args.push(
      "-filter_complex",
      filters.join(";"),
      "-map",
      "[vout]",
      "-map",
      "[aout]",
      "-t",
      duration.toFixed(2),
      "-r",
      String(FPS),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest"
    );

    const outPath = path.join(jobDir, "output.mp4");
    args.push(outPath);

    try {
      await run(ffmpegPath, args);
    } catch (err) {
      const stderr = (err as { stderr?: string }).stderr;
      throw new Error(`ffmpeg failed: ${stderr?.slice(-2000) || String(err)}`);
    }
    return await fs.readFile(outPath);
  } finally {
    await fs.rm(jobDir, { recursive: true, force: true });
  }
}
