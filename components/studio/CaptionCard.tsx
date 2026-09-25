"use client";

import { useRef, useState } from "react";
import { wrapCaptionLines } from "@/lib/composition";
import { TRACKS } from "@/lib/layerMeta";
import { CheckIcon, Spinner } from "../icons";

const MAX = 60;

/**
 * Caption edits show up live in the preview while typing (via onDraft) and
 * are saved to the database on blur or Enter — no separate save button.
 */
export function CaptionCard({
  caption,
  disabled,
  onDraft,
  onSave,
}: {
  caption: string;
  disabled: boolean;
  onDraft: (value: string) => void;
  onSave: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(caption);
  const [synced, setSynced] = useState(caption);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  // Enter saves and then blurs; this stops the blur from sending the same value twice.
  const inFlight = useRef<string | null>(null);
  if (caption !== synced) {
    setSynced(caption);
    setDraft(caption);
  }

  const shown = wrapCaptionLines(draft).join(" ");
  const truncated = draft.trim().length > 0 && shown.length < draft.trim().replace(/\s+/g, " ").length;

  async function commit() {
    const value = draft.trim();
    if (!value || value === caption || value === inFlight.current || disabled) {
      if (!value) {
        setDraft(caption);
        onDraft(caption);
      }
      return;
    }
    inFlight.current = value;
    setState("saving");
    setError(null);
    try {
      await onSave(value);
      setState("saved");
      setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 1600);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      inFlight.current = null;
    }
  }

  return (
    <section
      className="rounded-2xl border border-line bg-card px-4 pt-3.5 pb-4"
      style={{ boxShadow: `inset 3px 0 0 ${TRACKS.caption.color}` }}
    >
      <header className="flex items-center gap-2">
        <h3 className="text-[14px] font-semibold">Caption</h3>
        <span className="font-mono text-[11px] text-ink-3">on screen, 0–7s</span>
        <span className="ml-auto flex h-5 items-center text-[12px] text-ink-3" aria-live="polite">
          {state === "saving" && <Spinner className="h-3.5 w-3.5" />}
          {state === "saved" && (
            <span className="flex items-center gap-1 text-l-audio">
              <CheckIcon className="h-3.5 w-3.5" /> Saved
            </span>
          )}
        </span>
      </header>
      <textarea
        value={draft}
        disabled={disabled}
        maxLength={MAX}
        rows={2}
        onChange={(e) => {
          setDraft(e.target.value);
          onDraft(e.target.value);
          if (state !== "idle") setState("idle");
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
            e.currentTarget.blur();
          }
        }}
        aria-label="Caption"
        className="mt-2.5 w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-[15px] leading-snug font-semibold focus:border-ink focus:outline-none disabled:opacity-60"
      />
      <div className="mt-1 flex justify-between font-mono text-[11px] text-ink-3">
        <span className={truncated ? "text-rec" : ""}>
          {truncated ? `Only "${shown}" fits in 2 lines` : "Enter to save · 2 lines max"}
        </span>
        <span className="tnum">
          {draft.length}/{MAX}
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-[12px] text-rec">
          {error}
        </p>
      )}
    </section>
  );
}
