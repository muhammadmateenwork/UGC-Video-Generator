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

/** Mirrors the "Neon Tape" mockup: a taped-down video card with a
 * background, a GIF badge peeling off the corner, and a waveform for the
 * audio layer — the four real layers a render assembles, not a decorative
 * graphic. Kept compact so it's visible without scrolling on a laptop. */
function VideoTapeCard() {
  return (
    <div className="relative mx-auto w-full max-w-[170px]">
      <div className="absolute inset-0 -z-10 scale-90 rounded-full bg-accent/25 blur-3xl" aria-hidden />
      <div className="animate-float relative">
        <div
          className="tape-stripe absolute -top-2.5 left-1/2 h-6 w-[64px] -translate-x-1/2 -rotate-2 rounded-sm opacity-95 shadow-[0_4px_10px_-4px_rgba(0,0,0,0.5)]"
          aria-hidden
        />
        <div className="absolute -top-3 -right-3.5 z-10 flex h-12 w-12 rotate-12 items-center justify-center rounded-full border-[3px] border-background bg-accent3 text-center text-[9px] font-bold text-background shadow-[0_8px_16px_-6px_rgba(0,0,0,0.6)]">
          GIF
        </div>
        <div className="rounded-[1.1rem] border-2 border-accent bg-surface p-2.5 pb-7 shadow-warm-lg">
          <div className="relative aspect-[9/16] overflow-hidden rounded-lg bg-gradient-to-br from-accent2 via-purple-600 to-accent">
            <div className="absolute inset-0 flex items-center justify-center">
              <PlayIcon className="h-7 w-7 text-white/80" />
            </div>
            <div className="animate-waveform absolute inset-x-2 bottom-2 flex items-end gap-[3px]">
              {[5, 10, 7, 13, 8, 11, 6, 9].map((h, i) => (
                <span
                  key={i}
                  className="w-1.5 rounded-full bg-accent3"
                  style={{ height: `${h}px`, animationDelay: `${i * 90}ms` }}
                />
              ))}
            </div>
          </div>
          <p className="absolute inset-x-2 bottom-2 text-center font-display text-[12px] font-bold text-foreground">
            the drop ♪
          </p>
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
            <span className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">
              Not AI-generated, AI-organized
            </span>
          </div>
          <h1 className="font-display text-4xl leading-[1.08] font-bold text-foreground sm:text-5xl xl:text-6xl">
            Tape it in.
            <br />
            Watch it <span className="inline-block -rotate-3 text-accent3">blow up.</span>
          </h1>
          <p className="max-w-md text-base leading-relaxed text-ink-soft">
            Drop a product URL in the chat and we&apos;ll tape together a
            background, a caption, a GIF, and trending audio into one loud
            vertical video — ready to post, not just generated.
          </p>

          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {FEATURES.map((f, i) => (
              <li key={f.text} className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
                <f.icon
                  className="h-3.5 w-3.5"
                  style={{ color: [`var(--accent)`, `var(--accent2)`, `var(--accent3)`][i % 3] }}
                />
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
                  className="shadow-warm group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-left text-sm text-ink-soft transition hover:-translate-y-0.5 hover:border-accent hover:text-foreground hover:shadow-warm-lg"
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
          <VideoTapeCard />
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
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{
                backgroundColor: [`var(--accent-soft)`, `color-mix(in srgb, var(--accent2) 20%, transparent)`, `color-mix(in srgb, var(--accent3) 22%, transparent)`, `var(--accent-soft)`][i],
                color: [`var(--accent)`, `var(--accent2)`, `var(--accent3)`, `var(--accent)`][i],
              }}
            >
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
