"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A looping transport clock for the live preview. The canvas, the timeline
 * playhead and the media elements all read `t` from here, so they can't
 * drift apart the way several independently playing elements would.
 */
export function useClock(duration: number, initial = 0) {
  const [t, setT] = useState(initial);
  const [playing, setPlaying] = useState(false);
  const origin = useRef(0);
  const frame = useRef(0);

  useEffect(() => {
    if (!playing) return;
    origin.current = performance.now() - t * 1000;
    const tick = (now: number) => {
      setT((((now - origin.current) / 1000) % duration + duration) % duration);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
    // `t` is only read to resume from the current position when play starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, duration]);

  const seek = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), duration - 0.001);
      origin.current = performance.now() - clamped * 1000;
      setT(clamped);
    },
    [duration]
  );

  return { t, playing, setPlaying, seek };
}

export function formatTime(t: number) {
  const s = Math.floor(t);
  const cs = Math.floor((t - s) * 100);
  return `00:0${s}.${cs.toString().padStart(2, "0")}`;
}
