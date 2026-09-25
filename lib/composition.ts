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

// ---------------------------------------------------------------- layout

/**
 * Everything the user can move, resize, retime, recolour or switch off.
 * Stored per project as one JSON value and normalised by normalizeLayout()
 * on every read and write, so the client, the API and ffmpeg can never
 * disagree about what a layout means. Positions are fractions of the frame
 * (resolution-independent); times are fractions of the clip.
 */
export interface Layout {
  caption: {
    enabled: boolean;
    /** Horizontal centre of the caption, 0–1. */
    x: number;
    /** Top edge of the caption, 0–1. */
    y: number;
    /** Size multiplier on the style's base size. */
    scale: number;
    /** Text colour; null keeps the style's own. */
    color: string | null;
    /** The style's second colour — bar, pill or outline; null keeps the style's own. */
    accent: string | null;
    start: number;
    end: number;
  };
  gif: {
    enabled: boolean;
    /** Horizontal centre, 0–1. */
    x: number;
    /** Top edge, 0–1. */
    y: number;
    /** Width in render pixels (of 720). */
    width: number;
    start: number;
    end: number;
  };
  audio: {
    enabled: boolean;
    volume: number;
  };
}

/** Reproduces the original fixed composition exactly, so existing projects don't move. */
export const DEFAULT_LAYOUT: Layout = {
  caption: {
    enabled: true,
    x: 0.5,
    y: (COMPOSITION.caption.y + COMPOSITION.caption.paddingTop) / COMPOSITION.height,
    scale: 1,
    color: null,
    accent: null,
    start: 0,
    end: 1,
  },
  gif: {
    enabled: true,
    x: (COMPOSITION.width - COMPOSITION.gif.right - COMPOSITION.gif.width / 2) / COMPOSITION.width,
    y: COMPOSITION.gif.top,
    width: COMPOSITION.gif.width,
    start: COMPOSITION.gif.start,
    end: COMPOSITION.gif.end,
  },
  audio: { enabled: true, volume: 1 },
};

export const LAYOUT_LIMITS = {
  captionScale: [0.6, 1.8],
  gifWidth: [120, 560],
  volume: [0, 1.5],
  /** Shortest on-screen window, as a fraction of the clip (~0.5s). */
  minWindow: 0.07,
} as const;

/** Colours offered in the studio; any #rrggbb is accepted by the API. */
export const CAPTION_COLORS = ["#ffffff", "#111111", "#ffe14d", "#ff5b24", "#ff4fa3", "#3d7bff", "#23d18b"] as const;

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const color = (v: unknown, fallback: string | null) => (v === null ? null : typeof v === "string" && HEX.test(v) ? v.toLowerCase() : fallback);

function windowOf(start: unknown, end: unknown, d: { start: number; end: number }) {
  let s = clamp(start, 0, 1, d.start);
  let e = clamp(end, 0, 1, d.end);
  if (e - s < LAYOUT_LIMITS.minWindow) {
    if (s + LAYOUT_LIMITS.minWindow <= 1) e = s + LAYOUT_LIMITS.minWindow;
    else s = e - LAYOUT_LIMITS.minWindow;
  }
  return { start: s, end: e };
}

/** Fills gaps with defaults and clamps everything into range. Accepts anything (e.g. raw JSON from the DB or a request). */
export function normalizeLayout(raw: unknown): Layout {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, Record<string, unknown> | undefined>;
  const c = r.caption ?? {};
  const g = r.gif ?? {};
  const a = r.audio ?? {};
  const D = DEFAULT_LAYOUT;
  return {
    caption: {
      enabled: bool(c.enabled, D.caption.enabled),
      x: clamp(c.x, 0.1, 0.9, D.caption.x),
      y: clamp(c.y, 0, 0.92, D.caption.y),
      scale: clamp(c.scale, ...LAYOUT_LIMITS.captionScale, D.caption.scale),
      color: color(c.color, D.caption.color),
      accent: color(c.accent, D.caption.accent),
      ...windowOf(c.start, c.end, D.caption),
    },
    gif: {
      enabled: bool(g.enabled, D.gif.enabled),
      x: clamp(g.x, 0.05, 0.95, D.gif.x),
      y: clamp(g.y, 0, 0.95, D.gif.y),
      width: Math.round(clamp(g.width, ...LAYOUT_LIMITS.gifWidth, D.gif.width)),
      ...windowOf(g.start, g.end, D.gif),
    },
    audio: {
      enabled: bool(a.enabled, D.audio.enabled),
      volume: clamp(a.volume, ...LAYOUT_LIMITS.volume, D.audio.volume),
    },
  };
}

function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

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
export function captionCss(
  style: CaptionStyle,
  u: (px: number) => string,
  overrides: { color?: string | null; accent?: string | null } = {}
): { box: CSSProperties; line: CSSProperties } {
  const C = COMPOSITION.caption;
  const { color: text, accent } = overrides;
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
          color: text ?? "white",
          WebkitTextStroke: `${u(3)} ${accent ?? "#000"}`,
          textShadow: `0 ${u(4)} ${u(14)} rgba(0,0,0,0.45)`,
        },
      };
    case "pill":
      return {
        box: { ...column, gap: u(0) },
        line: {
          ...base,
          color: text ?? "#111",
          backgroundColor: accent ?? "white",
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
          color: text ?? "#ffe14d",
          textTransform: "uppercase",
          fontSize: u(46),
          letterSpacing: u(0.5),
          WebkitTextStroke: `${u(2)} ${accent ?? "#111"}`,
          textShadow: `${u(4)} ${u(5)} 0 ${accent ?? "#111"}`,
        },
      };
    case "box":
    default:
      return {
        box: {
          ...column,
          backgroundColor: accent ? withAlpha(accent, 0.72) : C.boxColor,
          padding: `${u(C.padY)} ${u(C.padX)}`,
        },
        line: { ...base, color: text ?? "white" },
      };
  }
}

/** What the "accent" colour means for each style, for the studio's label. */
export const ACCENT_LABEL: Record<CaptionStyle, string> = {
  box: "Bar",
  outline: "Outline",
  pill: "Pill",
  pop: "Outline",
};
