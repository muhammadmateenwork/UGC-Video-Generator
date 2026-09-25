"use client";

import { useRef } from "react";
import { COMPOSITION } from "@/lib/composition";
import { TRACKS, TRACK_ORDER, type TrackId } from "@/lib/layerMeta";
import type { LayerDTO } from "@/lib/dto";

const { duration: D, fade: FADE, gif: G } = COMPOSITION;
const pct = (s: number) => `${(s / D) * 100}%`;

/** Deterministic pseudo-waveform so the audio clip reads as audio, stable across renders. */
function bars(seed: string, n = 56) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return Array.from({ length: n }, () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    return 0.25 + ((h >>> 0) % 1000) / 1333;
  });
}

/**
 * The clip's actual edit decision list, drawn: when each layer is on screen
 * and where the fades sit — the GIF window and fade lengths come straight
 * from the same spec ffmpeg renders with. Click or drag anywhere to scrub.
 */
export function Timeline({
  layers,
  caption,
  busyLabel,
  t,
  onSeek,
}: {
  layers: Partial<Record<"background" | "gif" | "audio", LayerDTO>>;
  caption: string;
  /** While rendering: the current stage, drawn as a sweep across the tracks. */
  busyLabel?: string | null;
  t: number;
  onSeek: (t: number) => void;
}) {
  const laneRef = useRef<HTMLDivElement>(null);

  const seekFromEvent = (clientX: number) => {
    const el = laneRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    onSeek(((clientX - r.left) / r.width) * D);
  };

  const clip: Record<TrackId, { start: number; end: number; present: boolean }> = {
    background: { start: 0, end: D, present: !!layers.background },
    caption: { start: 0, end: D, present: !!caption.trim() },
    gif: { start: D * G.start, end: D * G.end, present: !!layers.gif },
    audio: { start: 0, end: D, present: !!layers.audio },
  };

  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-card p-3 select-none">
      <div className="w-[92px] shrink-0 sm:w-[112px]">
        <div className="h-6" />
        {TRACK_ORDER.map((id) => (
          <div key={id} className="flex h-10 items-center gap-2 text-[12px] font-medium">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TRACKS[id].color }} />
            <span className="truncate">{TRACKS[id].label}</span>
          </div>
        ))}
      </div>

      <div
        ref={laneRef}
        role="slider"
        aria-label="Playhead"
        aria-valuemin={0}
        aria-valuemax={D}
        aria-valuenow={Number(t.toFixed(2))}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") onSeek(t + 0.25);
          if (e.key === "ArrowLeft") onSeek(t - 0.25);
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromEvent(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) seekFromEvent(e.clientX);
        }}
        className="relative min-w-0 flex-1 cursor-ew-resize touch-none rounded-md"
      >
        <div className="relative h-6 font-mono text-[10px] text-ink-3">
          {Array.from({ length: D + 1 }, (_, s) => (
            <span
              key={s}
              className="absolute top-0 tnum"
              style={{
                left: pct(s),
                transform: s === 0 ? "none" : s === D ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              {s}s
            </span>
          ))}
        </div>
        {TRACK_ORDER.map((id) => (
          <div key={id} className="relative my-1 h-8 rounded-md bg-paper-2/70">
            {clip[id].present ? (
              <Clip id={id} {...clip[id]} layers={layers} caption={caption} />
            ) : (
              <span className="absolute inset-0 grid place-items-center font-mono text-[10px] text-ink-3">empty</span>
            )}
          </div>
        ))}
        {busyLabel && (
          <div className="pointer-events-none absolute inset-x-0 top-6 bottom-0 overflow-hidden rounded-md">
            <div className="absolute inset-0 animate-sweep bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--rec)_22%,transparent),transparent)] bg-[length:40%_100%] bg-no-repeat" />
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink px-3 py-1 font-mono text-[11px] whitespace-nowrap text-paper">
              {busyLabel}…
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute top-4 bottom-0 w-px bg-rec" style={{ left: pct(t) }}>
          <div className="absolute -top-1 -left-[5px] h-2.5 w-[11px] rounded-[3px] bg-rec" />
        </div>
      </div>
    </div>
  );
}

function Clip({
  id,
  start,
  end,
  layers,
  caption,
}: {
  id: TrackId;
  start: number;
  end: number;
  layers: Partial<Record<"background" | "gif" | "audio", LayerDTO>>;
  caption: string;
}) {
  const color = TRACKS[id].color;
  const fades = id === "background" || id === "audio";
  const thumb = id === "background" ? layers.background?.thumbUrl : id === "gif" ? layers.gif?.previewUrl : null;

  return (
    <div
      className="absolute inset-y-0 overflow-hidden rounded-md border"
      style={{
        left: pct(start),
        width: pct(end - start),
        borderColor: color,
        background: `color-mix(in srgb, ${color} 14%, var(--card))`,
      }}
    >
      {thumb && (
        <div
          className="absolute inset-0 opacity-80"
          style={{ backgroundImage: `url("${thumb}")`, backgroundSize: "auto 100%", backgroundRepeat: "repeat-x" }}
        />
      )}
      {id === "caption" && (
        <span className="absolute inset-0 flex items-center truncate px-2 text-[11px] font-semibold" style={{ color }}>
          {caption}
        </span>
      )}
      {id === "audio" && (
        <div className="absolute inset-x-1 inset-y-1.5 flex items-center gap-[2px]">
          {bars(layers.audio?.previewUrl ?? "a").map((h, i) => (
            <span key={i} className="flex-1 rounded-full" style={{ height: `${h * 100}%`, background: color, opacity: 0.8 }} />
          ))}
        </div>
      )}
      {fades && (
        <>
          <span
            className="absolute inset-y-0 left-0"
            style={{ width: pct(FADE * (D / (end - start))), background: "linear-gradient(to bottom right, var(--card) 50%, transparent 50%)" }}
          />
          <span
            className="absolute inset-y-0 right-0"
            style={{ width: pct(FADE * (D / (end - start))), background: "linear-gradient(to bottom left, var(--card) 50%, transparent 50%)" }}
          />
        </>
      )}
    </div>
  );
}
