"use client";

import { useRef, useState } from "react";
import {
  ACCENT_LABEL,
  CAPTION_COLORS,
  CAPTION_STYLES,
  CAPTION_STYLE_META,
  DEFAULT_LAYOUT,
  LAYOUT_LIMITS,
  captionCss,
  wrapCaptionLines,
  type CaptionStyle,
  type Layout,
} from "@/lib/composition";
import { ColorSwatches, Slider, Switch } from "./controls";
import { TRACKS } from "@/lib/layerMeta";
import { CheckIcon, Spinner } from "../icons";

const MAX = 60;

/**
 * Caption edits show up live in the preview while typing (via onDraft) and
 * are saved to the database on blur or Enter — no separate save button.
 */
export function CaptionCard({
  caption,
  captionStyle,
  layout,
  disabled,
  onDraft,
  onSave,
  onStyle,
  onLayout,
}: {
  caption: string;
  captionStyle: CaptionStyle;
  layout: Layout["caption"];
  /** `commit` false = live preview only; true = save. */
  onLayout: (next: Layout["caption"], commit: boolean) => void;
  disabled: boolean;
  onDraft: (value: string) => void;
  onSave: (value: string) => Promise<void>;
  onStyle: (style: CaptionStyle) => void;
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
        <span className="font-mono text-[11px] text-ink-3 tnum">
          {layout.enabled ? `${(layout.start * 7).toFixed(1)}–${(layout.end * 7).toFixed(1)}s` : "off"}
        </span>
        <span className="ml-auto flex h-5 items-center text-[12px] text-ink-3" aria-live="polite">
          {state === "saving" && <Spinner className="h-3.5 w-3.5" />}
          {state === "saved" && (
            <span className="flex items-center gap-1 text-l-audio">
              <CheckIcon className="h-3.5 w-3.5" /> Saved
            </span>
          )}
        </span>
        <Switch
          label="Caption"
          checked={layout.enabled}
          disabled={disabled}
          color={TRACKS.caption.color}
          onChange={(enabled) => onLayout({ ...layout, enabled }, true)}
        />
      </header>
      <div className={layout.enabled ? "" : "pointer-events-none opacity-40"}>
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
      <div className="mt-3 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Caption style">
        {CAPTION_STYLES.map((s) => (
          <StyleSwatch key={s} style={s} active={s === captionStyle} disabled={disabled} onPick={() => onStyle(s)} />
        ))}
      </div>
      <div className="mt-3.5 space-y-2.5 border-t border-line-2 pt-3">
        <ColorSwatches
          label="Text"
          colors={CAPTION_COLORS}
          value={layout.color}
          disabled={disabled}
          onChange={(color) => onLayout({ ...layout, color }, true)}
        />
        <ColorSwatches
          label={ACCENT_LABEL[captionStyle]}
          colors={CAPTION_COLORS}
          value={layout.accent}
          disabled={disabled}
          onChange={(accent) => onLayout({ ...layout, accent }, true)}
        />
        <Slider
          label="Size"
          value={layout.scale}
          min={LAYOUT_LIMITS.captionScale[0]}
          max={LAYOUT_LIMITS.captionScale[1]}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          disabled={disabled}
          color={TRACKS.caption.color}
          onChange={(scale) => onLayout({ ...layout, scale }, false)}
          onCommit={() => onLayout(layout, true)}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            const d = DEFAULT_LAYOUT.caption;
            onLayout({ ...layout, x: d.x, y: d.y, scale: d.scale, start: d.start, end: d.end }, true);
          }}
          className="font-mono text-[11px] text-ink-3 underline decoration-line underline-offset-2 hover:text-ink disabled:opacity-40"
        >
          Reset position, size and timing
        </button>
      </div>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-[12px] text-rec">
          {error}
        </p>
      )}
    </section>
  );
}

/** A real miniature of the style — drawn with the same captionCss the renderer uses, just scaled down. */
function StyleSwatch({
  style,
  active,
  disabled,
  onPick,
}: {
  style: CaptionStyle;
  active: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  const css = captionCss(style, (px) => `${(px * 0.3).toFixed(2)}px`);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onPick}
      title={CAPTION_STYLE_META[style].hint}
      className={`group flex flex-col items-center gap-1 rounded-lg border p-1.5 transition disabled:opacity-50 ${
        active ? "border-ink bg-paper" : "border-line hover:border-ink-3"
      }`}
    >
      <span className="grid h-9 w-full place-items-center overflow-hidden rounded-md bg-[linear-gradient(135deg,#6f8f64,#c9b793)]">
        <span style={css.box}>
          <span style={{ ...css.line, fontFamily: "var(--font-caption)" }}>Aa</span>
        </span>
      </span>
      <span className={`text-[11px] ${active ? "font-semibold text-ink" : "text-ink-3"}`}>{CAPTION_STYLE_META[style].label}</span>
    </button>
  );
}
