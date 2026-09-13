"use client";

import { useRef, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUpIcon } from "./icons";

export function ChatInput({
  onSend,
  disabled,
  value,
  onValueChange,
  size = "default",
}: {
  onSend: (text: string) => void;
  disabled: boolean;
  value: string;
  onValueChange: (value: string) => void;
  size?: "default" | "large";
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function resize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    onValueChange("");
    requestAnimationFrame(resize);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const isLarge = size === "large";

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        submit();
      }}
      className={`flex flex-col gap-1 rounded-[26px] border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.25),0_10px_28px_-10px_rgba(0,0,0,0.55)] transition-colors focus-within:border-ink-soft/50 ${
        isLarge ? "p-4" : "p-3"
      }`}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          resize();
        }}
        onKeyDown={handleKeyDown}
        rows={isLarge ? 2 : 1}
        placeholder="Send a product URL, or just say hi..."
        className={`w-full resize-none bg-transparent text-foreground placeholder:text-ink-soft/50 focus:outline-none ${
          isLarge ? "max-h-32 text-base" : "max-h-24 text-[15px]"
        }`}
      />
      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className={`flex shrink-0 items-center justify-center rounded-full bg-accent text-background transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 ${
            isLarge ? "h-10 w-10" : "h-8 w-8"
          }`}
          aria-label="Send message"
        >
          <ArrowUpIcon className={isLarge ? "h-5 w-5" : "h-4 w-4"} />
        </button>
      </div>
    </form>
  );
}
