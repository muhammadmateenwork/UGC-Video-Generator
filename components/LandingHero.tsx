"use client";

import { LinkIcon, PlayIcon } from "./icons";

const SUGGESTIONS = [
  "I'm building CalAI, a calorie-tracking app. Here's the site: calai.app",
  "Check out allbirds.com, their wool runners need a video",
  "notion.so — make it look aspirational",
];

const STEPS = [
  "Share a product link in the chat",
  "We read the page and plan the creative",
  "Real stock footage, a GIF, and trending audio get assembled",
  "Your video link drops right back into the chat",
];

/**
 * Deliberately abstract, not a fake screenshot — two placeholder bars stand
 * in for a caption and a plain play glyph for the video, so the frame reads
 * as an honest diagram of the output rather than a mocked-up demo with
 * invented content.
 */
function VideoFrame() {
  return (
    <div className="shadow-warm-lg relative mx-auto w-full max-w-[168px] overflow-hidden rounded-[1.5rem] border-2 border-accent bg-surface">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center">
        <div className="mt-1.5 h-3.5 w-16 rounded-full bg-background/80" />
      </div>
      <div className="relative aspect-[9/16] bg-gradient-to-b from-surface-soft to-accent-soft/30">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25">
            <PlayIcon className="ml-0.5 h-3.5 w-3.5 text-white/70" />
          </div>
        </div>
        <div className="absolute inset-x-5 bottom-6 h-1.5 w-2/3 rounded-full bg-white/10" />
        <div className="absolute inset-x-5 bottom-4 h-1.5 rounded-full bg-white/15" />
      </div>
    </div>
  );
}

export function LandingHero({
  onSuggestion,
}: {
  onSuggestion: (text: string) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 py-4 text-center sm:px-6">
      <span className="animate-fade-up text-xs font-medium tracking-[0.14em] text-accent uppercase">
        Not AI-generated — AI-organized
      </span>

      <div className="animate-fade-up flex w-full flex-col items-center gap-2.5" style={{ animationDelay: "40ms" }}>
        <h1 className="font-display text-4xl leading-[1.1] font-semibold text-foreground sm:text-5xl">
          One link in.
          <br />
          <span className="text-accent">One video out.</span>
        </h1>
        <p className="max-w-md text-base leading-relaxed text-ink-soft">
          Send a product URL in the chat and get back a short vertical video
          — a real background, a caption, a GIF, and trending audio,
          assembled automatically.
        </p>
      </div>

      <div className="animate-fade-up w-full" style={{ animationDelay: "90ms" }}>
        <VideoFrame />
      </div>

      <p className="animate-fade-up text-xs font-medium text-ink-soft/80" style={{ animationDelay: "120ms" }}>
        Renders in under a minute
        <span className="mx-2 text-border">·</span>
        4 real layers, not AI video
        <span className="mx-2 text-border">·</span>
        No sign-up to try it
      </p>

      <div className="animate-fade-up flex w-full flex-col items-center gap-2" style={{ animationDelay: "150ms" }}>
        <span className="text-xs font-medium text-ink-soft/70">Try an example:</span>
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onSuggestion(s)}
              className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-left text-sm text-ink-soft transition hover:border-accent/50 hover:text-foreground"
            >
              <LinkIcon className="h-3.5 w-3.5 shrink-0 text-ink-soft/60 transition group-hover:text-accent" />
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px w-full max-w-xs bg-border" />

      <ol className="grid w-full grid-cols-1 gap-x-8 gap-y-5 text-left sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li
            key={step}
            className="animate-fade-up flex flex-col gap-1.5 border-t border-border pt-3"
            style={{ animationDelay: `${190 + i * 60}ms` }}
          >
            <span className="text-xs font-semibold text-accent">0{i + 1}</span>
            <p className="text-sm leading-snug text-ink-soft">{step}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
