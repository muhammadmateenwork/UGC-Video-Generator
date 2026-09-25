import type { CSSProperties } from "react";

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

export const CAPTION_STYLES = ["box", "outline", "pill", "pop"] as const;
export type CaptionStyle = (typeof CAPTION_STYLES)[number];

export const CAPTION_STYLE_META: Record<CaptionStyle, { label: string; hint: string }> = {
  box: { label: "Boxed", hint: "Clean text on a translucent bar" },
  outline: { label: "Outline", hint: "Classic stroked meme text" },
  pill: { label: "TikTok", hint: "Native-app white pills" },
  pop: { label: "Pop", hint: "Loud yellow, all caps" },
};

export function isCaptionStyle(v: unknown): v is CaptionStyle {
  return typeof v === "string" && (CAPTION_STYLES as readonly string[]).includes(v);
}

/**
 * The CSS for each caption style, written once in render pixels. `u`
 * converts a pixel value into the target's unit: plain px for the Satori
 * renderer that burns the caption into the MP4, container-query units for
 * the live preview — so a style can't look different in the two places.
 * Only properties Satori supports are used (no paint-order, no filters).
 */
export function captionCss(style: CaptionStyle, u: (px: number) => string): { box: CSSProperties; line: CSSProperties } {
  const C = COMPOSITION.caption;
  const base: CSSProperties = {
    color: "white",
    fontSize: u(C.fontSize),
    fontWeight: C.fontWeight,
    letterSpacing: u(C.letterSpacing),
    lineHeight: C.lineHeight,
    whiteSpace: "nowrap",
  };
  const column: CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center" };

  switch (style) {
    case "outline":
      return {
        box: column,
        line: {
          ...base,
          fontSize: u(54),
          WebkitTextStroke: `${u(3)} #000`,
          textShadow: `0 ${u(4)} ${u(14)} rgba(0,0,0,0.45)`,
        },
      };
    case "pill":
      return {
        box: { ...column, gap: u(0) },
        line: {
          ...base,
          color: "#111",
          backgroundColor: "white",
          borderRadius: u(14),
          padding: `${u(4)} ${u(20)}`,
          fontSize: u(44),
        },
      };
    case "pop":
      return {
        box: column,
        line: {
          ...base,
          color: "#ffe14d",
          textTransform: "uppercase",
          fontSize: u(46),
          letterSpacing: u(0.5),
          WebkitTextStroke: `${u(2)} #111`,
          textShadow: `${u(4)} ${u(5)} 0 #111`,
        },
      };
    case "box":
    default:
      return {
        box: { ...column, backgroundColor: C.boxColor, padding: `${u(C.padY)} ${u(C.padX)}` },
        line: base,
      };
  }
}
