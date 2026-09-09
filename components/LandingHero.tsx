"use client";

import { ClockIcon, LayersIcon, LinkIcon, SparkIcon, UnlockIcon, WandIcon } from "./icons";

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

/** Purely illustrative — not a screen capture of real output — representing
 * the four layers a render actually assembles: background, caption, GIF, audio. */
function LayerStackPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[190px]">
      <div
        className="absolute inset-0 -z-10 scale-90 rounded-full bg-accent/30 blur-3xl"
        aria-hidden
      />
      <div className="animate-float">
        <div className="relative aspect-[9/16] overflow-hidden rounded-[1.75rem] border-[3px] border-ink bg-gradient-to-b from-orange-300 via-orange-400 to-ink shadow-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
            <div className="mt-1.5 h-3.5 w-16 rounded-full bg-ink/90" />
          </div>
          <div className="absolute inset-x-3 top-7 rounded-lg bg-black/45 px-2 py-1.5 text-center text-[11px] font-semibold text-white backdrop-blur-sm">
            this changes everything
          </div>
          <div className="absolute right-3 bottom-10 flex h-14 w-14 items-center justify-center rounded-xl bg-white/90 shadow-md ring-2 ring-white/60">
            <SparkIcon className="h-6 w-6 text-accent" />
          </div>
          <div className="animate-waveform absolute inset-x-3 bottom-3 flex items-end gap-[3px]">
            {[6, 12, 8, 16, 10, 14, 7, 11].map((h, i) => (
              <span
                key={i}
                className="w-1.5 rounded-full bg-white/70"
                style={{ height: `${h}px`, animationDelay: `${i * 90}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-ink-soft/70">illustrative — not real output</p>
    </div>
  );
}

export function LandingHero({
  onSuggestion,
}: {
  onSuggestion: (text: string) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-12 px-4 py-12 sm:px-6">
      <div className="grid w-full items-center gap-10 md:grid-cols-[1.15fr_0.85fr] md:gap-12">
        <div className="animate-fade-up flex flex-col items-start gap-5 text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent-soft/50 px-3 py-1 text-xs font-medium text-ink-soft shadow-sm">
            <SparkIcon className="h-3.5 w-3.5 text-accent" />
            Not AI-generated. AI-organized.
          </span>
          <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-ink sm:text-5xl xl:text-6xl">
            Turn any product page into a{" "}
            <span className="bg-gradient-to-r from-accent to-orange-600 bg-clip-text text-transparent">
              UGC-style ad
            </span>
          </h1>
          <p className="max-w-md text-base leading-relaxed text-ink-soft">
            Drop a product URL in the chat. We read the page, then pick a
            background, a GIF, trending audio, and a caption that actually
            fit the product — and hand you back a ready vertical video.
          </p>

          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
                <f.icon className="h-3.5 w-3.5 text-accent" />
                {f.text}
              </li>
            ))}
          </ul>

          <div className="mt-1 flex flex-col gap-2">
            <span className="text-xs font-medium text-ink-soft/70">Try an example:</span>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onSuggestion(s)}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-left text-sm text-ink-soft shadow-sm transition hover:-translate-y-0.5 hover:border-accent/50 hover:text-ink hover:shadow-md"
                >
                  <LinkIcon className="h-3.5 w-3.5 shrink-0 text-ink-soft/60 transition group-hover:text-accent" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: "100ms" }}>
          <LayerStackPreview />
        </div>
      </div>

      <div className="h-px w-full max-w-xs bg-gradient-to-r from-transparent via-border to-transparent" />

      <ol className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li
            key={step.text}
            className="animate-fade-up flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 transition hover:-translate-y-0.5 hover:shadow-md"
            style={{ animationDelay: `${150 + i * 60}ms` }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <step.icon className="h-4 w-4" />
            </div>
            <p className="text-sm leading-snug text-ink-soft">
              <span className="mr-1 font-semibold text-ink">{i + 1}.</span>
              {step.text}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
