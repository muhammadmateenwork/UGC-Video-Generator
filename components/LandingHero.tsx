"use client";

import { LayersIcon, LinkIcon, SparkIcon, WandIcon } from "./icons";

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

/** Purely illustrative — not a screen capture of real output — representing
 * the four layers a render actually assembles: background, caption, GIF, audio. */
function LayerStackPreview() {
  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[190px] overflow-hidden rounded-[1.75rem] border-[3px] border-ink bg-gradient-to-b from-orange-300 via-orange-400 to-ink shadow-lg">
      <div className="absolute inset-x-3 top-6 rounded-lg bg-black/45 px-2 py-1.5 text-center text-[11px] font-semibold text-white backdrop-blur-sm">
        this changes everything
      </div>
      <div className="absolute inset-x-0 bottom-10 flex justify-center">
        <div className="h-16 w-16 rounded-full bg-white/90 shadow-md" />
      </div>
      <div className="absolute inset-x-3 bottom-3 flex items-end gap-[3px]">
        {[6, 12, 8, 16, 10, 14, 7, 11].map((h, i) => (
          <div key={i} className="w-1.5 rounded-full bg-white/70" style={{ height: `${h}px` }} />
        ))}
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
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-10 px-4 py-10 sm:px-6">
      <div className="grid w-full items-center gap-10 md:grid-cols-[1.15fr_0.85fr] md:gap-12">
        <div className="flex flex-col items-start gap-5 text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-ink-soft">
            <SparkIcon className="h-3.5 w-3.5 text-accent" />
            Not AI-generated. AI-organized.
          </span>
          <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-ink sm:text-5xl">
            Turn any product page into a{" "}
            <span className="text-accent">UGC-style ad</span>
          </h1>
          <p className="max-w-md text-base leading-relaxed text-ink-soft">
            Drop a product URL in the chat. We read the page, then pick a
            background, a GIF, trending audio, and a caption that actually
            fit the product — and hand you back a ready vertical video.
          </p>

          <div className="mt-1 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onSuggestion(s)}
                className="rounded-full border border-border bg-surface px-3.5 py-2 text-left text-sm text-ink-soft transition hover:border-accent/50 hover:text-ink"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <LayerStackPreview />
      </div>

      <ol className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li
            key={step.text}
            className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4"
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
