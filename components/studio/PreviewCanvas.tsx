"use client";

import { useEffect, useRef } from "react";
import { COMPOSITION, wrapCaptionLines } from "@/lib/composition";
import type { LayerDTO } from "@/lib/dto";

const { width: W, height: H, duration: D, fade: FADE, caption: C, gif: G } = COMPOSITION;
const pctW = (px: number) => `${(px / W) * 100}%`;
const cqw = (px: number) => `${(px / W) * 100}cqw`;

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
 * The live composite: the same four layers the renderer will use, drawn
 * with the same geometry (container-query units map 1:1 onto the 720px
 * render). Lets you judge a combination before spending a render on it.
 */
export function PreviewCanvas({
  background,
  gif,
  audio,
  caption,
  t,
  playing,
  muted,
}: {
  background?: LayerDTO;
  gif?: LayerDTO;
  audio?: LayerDTO;
  caption: string;
  t: number;
  playing: boolean;
  muted: boolean;
}) {
  const bgRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  useSyncedMedia(bgRef, t, playing);
  useSyncedMedia(audioRef, t, playing, 0.35);

  const fadeOpacity = t < FADE ? 1 - t / FADE : t > D - FADE ? (t - (D - FADE)) / FADE : 0;
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.max(0, Math.min(1, 1 - fadeOpacity));
  }, [fadeOpacity]);

  const gifVisible = t >= D * G.start && t <= D * G.end;
  const lines = wrapCaptionLines(caption);

  return (
    <div className="canvas relative aspect-[9/16] w-full overflow-hidden rounded-[20px] bg-ink">
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

      {lines.length > 0 && (
        <div
          className="absolute inset-x-0 flex justify-center"
          style={{ top: `${((C.y + C.paddingTop) / H) * 100}%` }}
        >
          <div
            className="flex flex-col items-center text-center text-white"
            style={{
              background: C.boxColor,
              padding: `${cqw(C.padY)} ${cqw(C.padX)}`,
              fontSize: cqw(C.fontSize),
              lineHeight: C.lineHeight,
              fontFamily: "var(--font-caption)",
              fontWeight: C.fontWeight,
              letterSpacing: cqw(C.letterSpacing),
            }}
          >
            {lines.map((l, i) => (
              <span key={i} className="whitespace-nowrap">
                {l}
              </span>
            ))}
          </div>
        </div>
      )}

      {gif && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={gif.previewUrl}
          alt=""
          className="absolute transition-opacity duration-100"
          style={{
            width: pctW(G.width),
            right: pctW(G.right),
            top: `${G.top * 100}%`,
            opacity: gifVisible ? 1 : 0,
          }}
        />
      )}

      {audio && <audio ref={audioRef} key={audio.previewUrl} src={audio.previewUrl} loop muted={muted} preload="auto" />}

      <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: fadeOpacity }} />
    </div>
  );
}
