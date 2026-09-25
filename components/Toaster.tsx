"use client";

import { useSyncExternalStore } from "react";
import { AlertIcon, CheckIcon } from "./icons";

type Toast = { id: number; message: string; tone: "ok" | "error" | "info" };

// A tiny module-level store: any client code can call toast() without a
// provider, and the one <Toaster/> in the root layout renders the queue.
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(message: string, tone: Toast["tone"] = "info") {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, message, tone }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, tone === "error" ? 6000 : 3200);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const EMPTY: Toast[] = [];

export function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className="pointer-events-auto flex max-w-md animate-rise items-center gap-2.5 rounded-full bg-ink py-2.5 pr-5 pl-3 text-[14px] text-paper shadow-[0_12px_32px_-12px_rgba(22,21,19,0.6)]"
        >
          <span
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
              t.tone === "error" ? "bg-rec" : t.tone === "ok" ? "bg-l-audio" : "bg-paper/15"
            }`}
          >
            {t.tone === "error" ? <AlertIcon className="h-3.5 w-3.5" /> : <CheckIcon className="h-3.5 w-3.5" />}
          </span>
          <span className="line-clamp-2">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
