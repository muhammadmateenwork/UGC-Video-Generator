"use client";

import { useEffect, useRef, useState } from "react";
import {
  COMPOSITION,
  captionCss,
  normalizeLayout,
  wrapCaptionLines,
  type CaptionStyle,
  type Layout,
} from "@/lib/composition";
import type { LayerDTO } from "@/lib/dto";
import { TRACKS } from "@/lib/layerMeta";

const { width: W, duration: D, fade: FADE } = COMPOSITION;
const cqw = (px: number) => `${(px / W) * 100}cqw`;
const SNAP = 0.02;

type Target = "caption" | "gif";

/** Keeps a media element's playhead within `tolerance` of the shared clock. */
function useSyncedMedia(
  ref: React.RefObject<HTMLMediaElement | null>,
  t: number,
  playing: boolean,
  tolerance = 0.25
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (playing && el.paused) el.play().catch(() => {});
    if (!playing && !el.paused) el.pause();
  }, [ref, playing]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !Number.isFinite(el.duration) || el.duration === 0) return;
    const target = t % el.duration;
    if (Math.abs(el.currentTime - target) > tolerance) el.currentTime = target;
  }, [ref, t, tolerance]);
}

/**
 * The live composite — and, when editable, the place you arrange it. The
 * caption and GIF are drawn from the same Layout and captionCss the
 * renderer uses (container-query units map 1:1 onto the 720px render), so
 * dragging something here moves it in the MP4 by exactly the same amount.
 */
export function PreviewCanvas({
  background,
  gif,
  audio,
  caption,
  captionStyle,
  layout,
  t,
  playing,
  muted,
  editable = false,
  onLayout,
}: {
  background?: LayerDTO;
  gif?: LayerDTO;
  audio?: LayerDTO;
  caption: string;
  captionStyle: CaptionStyle;
  layout: Layout;
  t: number;
  playing: boolean;
  muted: boolean;
  editable?: boolean;
  /** `commit` is false while a drag is in progress and true when it ends. */
  onLayout?: (next: Layout, commit: boolean) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [selected, setSelected] = useState<Target | null>(null);
  const [guide, setGuide] = useState(false);
  useSyncedMedia(bgRef, t, playing);
  useSyncedMedia(audioRef, t, playing, 0.35);

  const fadeOpacity = t < FADE ? 1 - t / FADE : t > D - FADE ? (t - (D - FADE)) / FADE : 0;
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, (1 - fadeOpacity) * layout.audio.volume));
    }
  }, [fadeOpacity, layout.audio.volume]);

  const within = (w: { start: number; end: number }) => t >= D * w.start && t <= D * w.end;
  const lines = wrapCaptionLines(caption);
  const c = layout.caption;
  const g = layout.gif;
  const css = captionCss(captionStyle, (px) => cqw(px * c.scale), c);
  const showCaption = c.enabled && lines.length > 0;
  const showGif = g.enabled && !!gif;
  const arrange = editable && !playing;
  // While arranging (paused), keep a selected layer visible even outside its time window.
  const captionVisible = showCaption && (within(c) || (arrange && selected === "caption"));
  const gifVisible = showGif && (within(g) || (arrange && selected === "gif"));

  /** Generic drag: `apply` maps the pointer's movement (as fractions of the frame) to a new layout. */
  function startDrag(e: React.PointerEvent, target: Target, apply: (dx: number, dy: number, start: Layout) => Layout) {
    if (!arrange || !onLayout) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(target);
    const frame = frameRef.current!.getBoundingClientRect();
    const start = layout;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let latest = start;
    const move = (ev: PointerEvent) => {
      latest = normalizeLayout(apply((ev.clientX - x0) / frame.width, (ev.clientY - y0) / frame.height, start));
      onLayout(latest, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setGuide(false);
      if (latest !== start) onLayout(latest, true);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  /** Snaps a horizontal centre to the frame's middle and shows the guide while it's snapped. */
  function snapX(x: number) {
    const snapped = Math.abs(x - 0.5) < SNAP;
    setGuide(snapped);
    return snapped ? 0.5 : x;
  }

  const moveCaption = (e: React.PointerEvent) =>
    startDrag(e, "caption", (dx, dy, s) => ({
      ...s,
      caption: { ...s.caption, x: snapX(s.caption.x + dx), y: s.caption.y + dy },
    }));
  const resizeCaption = (e: React.PointerEvent) =>
    startDrag(e, "caption", (dx, _dy, s) => ({ ...s, caption: { ...s.caption, scale: s.caption.scale + dx * 3 } }));
  const moveGif = (e: React.PointerEvent) =>
    startDrag(e, "gif", (dx, dy, s) => ({ ...s, gif: { ...s.gif, x: snapX(s.gif.x + dx), y: s.gif.y + dy } }));
  // Anchored at its centre, so the width grows on both sides.
  const resizeGif = (e: React.PointerEvent) =>
    startDrag(e, "gif", (dx, _dy, s) => ({ ...s, gif: { ...s.gif, width: s.gif.width + dx * W * 2 } }));

  return (
    <div
      ref={frameRef}
      onPointerDown={() => setSelected(null)}
      className="canvas relative aspect-[9/16] w-full touch-none overflow-hidden rounded-[20px] bg-ink select-none"
    >
      {background?.mediaType === "video" ? (
        <video
          ref={bgRef}
          key={background.previewUrl}
          src={background.previewUrl}
          poster={background.thumbUrl ?? undefined}
          muted
          playsInline
          loop
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : background ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={background.previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center font-mono text-[11px] text-paper/40">no background</div>
      )}

      {guide && <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px bg-rec" />}

      {showCaption && (
        <div
          className="pointer-events-none absolute flex justify-center"
          style={{ top: `${c.y * 100}%`, left: `${(c.x - 0.5) * 100}%`, width: "100%", opacity: captionVisible ? 1 : 0 }}
        >
          <div
            onPointerDown={arrange ? moveCaption : undefined}
            className={`relative text-center ${arrange ? "pointer-events-auto cursor-move" : ""}`}
            style={css.box}
          >
            {lines.map((l, i) => (
              <span key={i} style={{ ...css.line, fontFamily: "var(--font-caption)" }}>
                {l}
              </span>
            ))}
            {arrange && selected === "caption" && (
              <Selection color={TRACKS.caption.color} label="Caption" onResize={resizeCaption} />
            )}
          </div>
        </div>
      )}

      {showGif && (
        <div
          onPointerDown={arrange ? moveGif : undefined}
          className={`absolute ${arrange ? "cursor-move" : "pointer-events-none"}`}
          style={{
            width: `${(g.width / W) * 100}%`,
            left: `${g.x * 100 - (g.width / W) * 50}%`,
            top: `${g.y * 100}%`,
            opacity: gifVisible ? 1 : 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gif!.previewUrl} alt="" draggable={false} className="block w-full" />
          {arrange && selected === "gif" && <Selection color={TRACKS.gif.color} label="GIF" onResize={resizeGif} />}
        </div>
      )}

      {audio && layout.audio.enabled && (
        <audio ref={audioRef} key={audio.previewUrl} src={audio.previewUrl} loop muted={muted} preload="auto" />
      )}

      {/* The fade only plays while playing — a paused frame should always show what you're arranging. */}
      <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: playing ? fadeOpacity : 0 }} />

      {arrange && !selected && (showCaption || showGif) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <span className="rounded-full bg-ink/70 px-2.5 py-1 font-mono text-[10px] text-paper backdrop-blur">
            drag to move · corner to resize
          </span>
        </div>
      )}
    </div>
  );
}

function Selection({ color, label, onResize }: { color: string; label: string; onResize: (e: React.PointerEvent) => void }) {
  return (
    <>
      <span className="pointer-events-none absolute -inset-1.5 rounded-md border-2 border-dashed" style={{ borderColor: color }} />
      <span
        className="pointer-events-none absolute -top-6 left-0 rounded px-1.5 py-0.5 font-mono text-[10px] leading-none whitespace-nowrap text-white"
        style={{ background: color }}
      >
        {label}
      </span>
      <span
        role="presentation"
        onPointerDown={onResize}
        className="absolute -right-3 -bottom-3 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-white shadow"
        style={{ background: color }}
      />
    </>
  );
}
