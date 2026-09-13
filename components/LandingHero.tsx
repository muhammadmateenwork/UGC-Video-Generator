"use client";

import { ChatInput } from "./ChatInput";

const SUGGESTIONS = [
  "I'm building CalAI, a calorie-tracking app. Here's the site: calai.app",
  "Check out allbirds.com, their wool runners need a video",
  "notion.so — make it look aspirational",
];

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
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-4 py-6 text-center sm:px-6">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-display text-[26px] leading-snug font-medium text-foreground sm:text-[28px]">
          What product should we turn into a video?
        </h1>
        <p className="text-sm text-ink-soft">
          Send a product link — real footage, a caption, a GIF, and trending audio, assembled automatically.
        </p>
      </div>

      <div className="w-full">
        <ChatInput
          value={value}
          onValueChange={onValueChange}
          onSend={onSend}
          disabled={disabled}
          size="large"
        />
      </div>

      <div className="flex w-full flex-col gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSend(s)}
            disabled={disabled}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm text-ink-soft transition hover:border-ink-soft/40 hover:bg-surface-soft hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
