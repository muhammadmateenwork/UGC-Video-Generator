"use client";

import { ClockIcon, LayersIcon, LinkIcon, PlayIcon, SparkIcon, UnlockIcon, WandIcon } from "./icons";

const SUGGESTIONS = [
  "I'm building CalAI, a calorie-tracking app. Here's the site: calai.app",
  "Check out allbirds.com, their wool runners need a video",
  "notion.so — make it look aspirational",
];

const STEPS = [
  { icon: LinkIcon, text: "Share a product link in the chat" },
  { icon: WandIcon, text: "We read the page and plan the creative" },
  { icon: LayersIcon, text: "Real stock footage, a GIF, and trending audio get assembled" },
  { icon: SparkIcon, text: "Your video link drops right back into the chat" },
];

const FEATURES = [
  { icon: ClockIcon, text: "Renders in under a minute" },
  { icon: LayersIcon, text: "4 real layers, not AI video" },
  { icon: UnlockIcon, text: "No sign-up to try it" },
];

/** A restrained preview of what a render looks like — a background, a
 * caption, a small GIF-layer indicator, and a waveform for the audio track.
 * Kept compact and flat (no props/novelty texture) so it reads as a product
 * screenshot, not a decoration. */
function VideoPreviewCard() {
  return (
    <div className="relative mx-auto w-full max-w-[180px]">
      <div className="absolute inset-0 -z-10 scale-90 rounded-full bg-accent/15 blur-3xl" aria-hidden />
      <div className="animate-float">
        <div className="rounded-2xl border border-border bg-surface p-2 shadow-warm-lg">
          <div className="relative aspect-[9/16] overflow-hidden rounded-lg bg-gradient-to-b from-surface-soft to-accent-soft">
            <div className="absolute top-3 right-3 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-medium tracking-wide text-white/80 uppercase">
              GIF
            </div>
            <div className="absolute inset-x-3 top-10 rounded-md bg-black/45 px-2.5 py-1.5 text-center text-[11px] font-medium text-white">
              the drop
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <PlayIcon className="h-7 w-7 text-white/70" />
            </div>
            <div className="animate-waveform absolute inset-x-3 bottom-3 flex items-end gap-[3px]">
              {[5, 9, 6, 12, 7, 10, 5, 8].map((h, i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-accent/80"
                  style={{ height: `${h}px`, animationDelay: `${i * 90}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
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
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-6 px-4 py-6 sm:px-6">
      <div className="grid w-full items-center gap-8 md:grid-cols-[1.15fr_0.85fr] md:gap-10">
        <div className="animate-fade-up order-2 flex flex-col items-start gap-4 text-left md:order-1 md:col-start-1">
          <div className="flex items-center gap-2.5">
            <span className="h-4 w-1 rounded-full bg-accent" aria-hidden />
            <span className="text-xs font-medium tracking-[0.14em] text-accent uppercase">
              Not AI-generated, AI-organized
            </span>
          </div>
          <h1 className="font-display text-4xl leading-[1.1] font-semibold text-foreground sm:text-5xl xl:text-6xl">
            One link in.
            <br />
            <span className="text-accent">One video out.</span>
          </h1>
          <p className="max-w-md text-base leading-relaxed text-ink-soft">
            Send a product URL in the chat and get back a short vertical
            video — a real background, a caption, a GIF, and trending audio,
            assembled automatically.
          </p>

          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
                <f.icon className="h-3.5 w-3.5 text-accent" />
                {f.text}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-ink-soft/70">Try an example:</span>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onSuggestion(s)}
                  className="shadow-warm group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-left text-sm text-ink-soft transition hover:-translate-y-0.5 hover:border-accent/50 hover:text-foreground hover:shadow-warm-lg"
                >
                  <LinkIcon className="h-3.5 w-3.5 shrink-0 text-ink-soft/60 transition group-hover:text-accent" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          className="animate-fade-up order-1 md:order-2 md:col-start-2"
          style={{ animationDelay: "100ms" }}
        >
          <VideoPreviewCard />
        </div>
      </div>

      <div className="h-px w-full max-w-xs bg-gradient-to-r from-transparent via-border to-transparent" />

      <ol className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li
            key={step.text}
            className="shadow-warm animate-fade-up flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:shadow-warm-lg"
            style={{ animationDelay: `${150 + i * 60}ms` }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <step.icon className="h-4 w-4" />
            </div>
            <p className="text-sm leading-snug text-ink-soft">
              <span className="mr-1 font-semibold text-foreground">{i + 1}.</span>
              {step.text}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
