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

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        submit();
      }}
      className={`flex items-end gap-2 rounded-full border-2 border-accent/60 bg-surface shadow-sm transition-shadow focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30 ${
        size === "large" ? "p-2.5 pl-6" : "p-2 pl-5"
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
        rows={1}
        placeholder="Send a product URL, or just say hi..."
        className={`max-h-40 flex-1 resize-none bg-transparent text-foreground placeholder:text-ink-soft/50 focus:outline-none ${
          size === "large" ? "px-2 py-3 text-base" : "px-2 py-2 text-[15px]"
        }`}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className={`flex shrink-0 items-center justify-center rounded-full bg-accent text-background transition-all hover:scale-105 hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:scale-100 disabled:opacity-40 ${
          size === "large" ? "h-12 w-12" : "h-10 w-10"
        }`}
        aria-label="Send message"
      >
        <ArrowUpIcon className="h-5 w-5" />
      </button>
    </form>
  );
}
