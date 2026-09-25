/**
 * The single source of truth for how a clip is laid out in space and time.
 * lib/assemble.ts (ffmpeg) and the studio's live preview both read from
 * here, so what you see before rendering is what the render produces —
 * change a number once and both move together.
 */
export const COMPOSITION = {
  width: 720,
  height: 1280,
  fps: 30,
  duration: 7,
  fade: 0.4,
  caption: {
    /** Top edge of the caption canvas in the frame. */
    y: 90,
    canvasHeight: 200,
    paddingTop: 20,
    padX: 24,
    padY: 14,
    fontSize: 48,
    /** Inter ExtraBold — bundled in assets/fonts for the render, loaded via next/font for the preview. */
    fontWeight: 800 as const,
    letterSpacing: -0.5,
    lineHeight: 1.25,
    maxCharsPerLine: 20,
    maxLines: 2,
    boxColor: "rgba(0,0,0,0.45)",
  },
  gif: {
    width: 250,
    /** Distance from the right edge. */
    right: 28,
    /** Top edge as a fraction of frame height. */
    top: 0.6,
    /** Visible window as fractions of the clip — a reaction beat, not wallpaper. */
    start: 0.12,
    end: 0.78,
  },
} as const;

/** Wraps caption text onto at most 2 lines so it never overflows the frame width. */
export function wrapCaptionLines(
  text: string,
  maxCharsPerLine: number = COMPOSITION.caption.maxCharsPerLine
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, COMPOSITION.caption.maxLines);
}
