"use client";

import { ChatInput } from "./ChatInput";
import { LinkIcon } from "./icons";

const SUGGESTIONS = [
  "I'm building CalAI, a calorie-tracking app. Here's the site: calai.app",
  "Check out allbirds.com, their wool runners need a video",
  "notion.so — make it look aspirational",
];

/**
 * The input is the hero, not an illustration of one — mirrors how
 * Claude/ChatGPT/Perplexity present their empty state, since a mocked-up
 * screenshot of the output would just be more invented content.
 */
export function LandingHero({
  value,
  onValueChange,
  onSend,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 px-4 py-6 text-center sm:px-6">
      <span className="animate-fade-up text-xs font-medium tracking-[0.14em] text-accent uppercase">
        Not AI-generated — AI-organized
      </span>

      <h1
        className="animate-fade-up font-display text-3xl leading-[1.15] font-semibold text-foreground sm:text-4xl"
        style={{ animationDelay: "40ms" }}
      >
        One link in.
        <br />
        One video out.
      </h1>

      <div className="animate-fade-up w-full" style={{ animationDelay: "80ms" }}>
        <ChatInput
          value={value}
          onValueChange={onValueChange}
          onSend={onSend}
          disabled={disabled}
          size="large"
        />
      </div>

      <div className="animate-fade-up flex flex-wrap justify-center gap-2" style={{ animationDelay: "120ms" }}>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSend(s)}
            disabled={disabled}
            className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-left text-sm text-ink-soft transition hover:border-accent/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <LinkIcon className="h-3.5 w-3.5 shrink-0 text-ink-soft/60 transition group-hover:text-accent" />
            {s}
          </button>
        ))}
      </div>

      <p className="animate-fade-up max-w-sm text-xs leading-relaxed text-ink-soft/70" style={{ animationDelay: "150ms" }}>
        Real stock footage, a caption, a GIF, and trending audio — assembled
        automatically. Not an AI video model.
      </p>
    </div>
  );
}
