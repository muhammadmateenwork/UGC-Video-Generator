/** Display metadata for the four layers — one colour per layer, used identically everywhere. */
export type TrackId = "background" | "caption" | "gif" | "audio";

export const TRACKS: Record<TrackId, { label: string; color: string; source: string; blurb: string }> = {
  background: {
    label: "Background",
    color: "var(--l-background)",
    source: "Pexels",
    blurb: "Real stock footage matched to the product's world",
  },
  caption: {
    label: "Caption",
    color: "var(--l-caption)",
    source: "Gemini",
    blurb: "Six words or fewer, written from the page itself",
  },
  gif: {
    label: "Reaction GIF",
    color: "var(--l-gif)",
    source: "Giphy",
    blurb: "A reaction beat, ranked to avoid watermarked uploads",
  },
  audio: {
    label: "Audio",
    color: "var(--l-audio)",
    source: "Freesound",
    blurb: "Music that fits the energy, by download count",
  },
};

export const TRACK_ORDER: TrackId[] = ["background", "caption", "gif", "audio"];
