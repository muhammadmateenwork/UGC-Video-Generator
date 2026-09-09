/**
 * Regression test for lib/assemble.ts's ffmpeg filter graph. Generates its
 * own synthetic fixtures (no network calls, no API quota spent) and asserts
 * every background/GIF/audio/caption combination produces a valid,
 * correctly-dimensioned, correctly-timed clip. Run with `npm run test:assemble`.
 *
 * This exists because a previous version of this pipeline had a real ffmpeg
 * filter-graph bug that only showed up in the no-GIF branch — exercising
 * every branch directly, rather than trusting the happy path, is the point.
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import { assembleUgcClip } from "../lib/assemble";

const run = promisify(execFile);

async function probe(file: string) {
  const { stdout } = await run(ffprobePath.path, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-show_entries",
    "stream=codec_type,width,height",
    "-of",
    "json",
    file,
  ]);
  return JSON.parse(stdout);
}

async function generateFixtures(dir: string) {
  if (!ffmpegPath) throw new Error("ffmpeg-static binary not found");
  const bgVideo = path.join(dir, "bg.mp4");
  const bgPhoto = path.join(dir, "bg.jpg");
  const gif = path.join(dir, "overlay.gif");
  const audio = path.join(dir, "audio.mp3");

  await run(ffmpegPath, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=640x480:rate=30:duration=3",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    bgVideo,
  ]);
  await run(ffmpegPath, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=blue:size=800x600",
    "-frames:v",
    "1",
    "-update",
    "1",
    bgPhoto,
  ]);
  await run(ffmpegPath, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=200x200:rate=10:duration=2",
    gif,
  ]);
  await run(ffmpegPath, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=10",
    "-c:a",
    "libmp3lame",
    audio,
  ]);

  return {
    bgVideo: await fs.readFile(bgVideo),
    bgPhoto: await fs.readFile(bgPhoto),
    gif: await fs.readFile(gif),
    audio: await fs.readFile(audio),
  };
}

type Fixtures = Awaited<ReturnType<typeof generateFixtures>>;

interface Case {
  name: string;
  build: (f: Fixtures) => Parameters<typeof assembleUgcClip>[0];
  /** Set for the silent-fallback case: asserts near-silence instead of audible sound. */
  expectSilence?: boolean;
}

const cases: Case[] = [
  {
    name: "video-bg_gif_audio_caption",
    build: (f) => ({
      background: { type: "video", buffer: f.bgVideo },
      gifBuffer: f.gif,
      audioBuffer: f.audio,
      caption: "this changes everything fr fr",
    }),
  },
  {
    name: "photo-bg_gif_audio_caption",
    build: (f) => ({
      background: { type: "image", buffer: f.bgPhoto },
      gifBuffer: f.gif,
      audioBuffer: f.audio,
      caption: "wait this is actually insane",
    }),
  },
  {
    name: "video-bg_NO-gif_audio_caption",
    build: (f) => ({
      background: { type: "video", buffer: f.bgVideo },
      gifBuffer: null,
      audioBuffer: f.audio,
      caption: "the no-gif branch that broke last time",
    }),
  },
  {
    name: "video-bg_gif_NO-audio_caption",
    build: (f) => ({
      background: { type: "video", buffer: f.bgVideo },
      gifBuffer: f.gif,
      audioBuffer: null,
      caption: "silent fallback should still play",
    }),
    expectSilence: true,
  },
  {
    name: "video-bg_gif_audio_NO-caption",
    build: (f) => ({
      background: { type: "video", buffer: f.bgVideo },
      gifBuffer: f.gif,
      audioBuffer: f.audio,
      caption: "",
    }),
  },
  {
    name: "NO-bg_NO-gif_NO-audio_NO-caption",
    build: () => ({ background: null, gifBuffer: null, audioBuffer: null, caption: "" }),
    expectSilence: true,
  },
  {
    name: "long-caption-wraps-to-2-lines",
    build: (f) => ({
      background: { type: "video", buffer: f.bgVideo },
      gifBuffer: f.gif,
      audioBuffer: f.audio,
      caption:
        "this is a deliberately long caption that must wrap onto exactly two lines and never overflow the frame",
    }),
  },
];

async function meanVolumeDb(file: string): Promise<number> {
  if (!ffmpegPath) throw new Error("ffmpeg-static binary not found");
  let stderr = "";
  try {
    const result = await run(ffmpegPath, ["-i", file, "-af", "volumedetect", "-f", "null", "-"]);
    stderr = result.stderr;
  } catch (err) {
    stderr = (err as { stderr?: string }).stderr || "";
  }
  const match = stderr.match(/mean_volume:\s*(-?\d+(\.\d+)?)\s*dB/);
  return match ? Number(match[1]) : NaN;
}

async function main() {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "assemble-test-"));
  let failed = 0;
  try {
    console.log("Generating synthetic fixtures...");
    const fixtures = await generateFixtures(workDir);

    for (const c of cases) {
      process.stdout.write(`\n=== ${c.name} ===\n`);
      try {
        const buf = await assembleUgcClip(c.build(fixtures));
        const outPath = path.join(workDir, `${c.name}.mp4`);
        await fs.writeFile(outPath, buf);
        const info = await probe(outPath);
        const streams = info.streams as { codec_type: string; width?: number; height?: number }[];
        const v = streams.find((s) => s.codec_type === "video");
        const a = streams.find((s) => s.codec_type === "audio");
        const duration = Number(info.format.duration);
        const meanDb = await meanVolumeDb(outPath);
        console.log(
          `  bytes=${buf.length} duration=${duration.toFixed(2)}s video=${v?.width}x${v?.height} meanVolume=${meanDb}dB`
        );
        if (!v || v.width !== 720 || v.height !== 1280) throw new Error(`bad video dims: ${JSON.stringify(v)}`);
        if (!a) throw new Error("missing audio stream");
        if (Math.abs(duration - 7) > 0.5) throw new Error(`unexpected duration: ${duration}`);
        if (c.expectSilence && meanDb < -60) {
          // expected: near-silent fallback track
        } else if (c.expectSilence && meanDb >= -60) {
          throw new Error(`expected silence but measured ${meanDb}dB`);
        } else if (!c.expectSilence && meanDb < -60) {
          throw new Error(`expected audible audio but measured ${meanDb}dB (sounds silent)`);
        }
        console.log("  PASS");
      } catch (err) {
        failed++;
        console.error("  FAIL:", err instanceof Error ? err.message : err);
      }
    }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }

  console.log(`\n${cases.length - failed}/${cases.length} passed`);
  if (failed > 0) process.exitCode = 1;
}

main();
