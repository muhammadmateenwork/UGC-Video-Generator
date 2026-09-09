import { ImageResponse } from "next/og";

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 200;

/** Wraps caption text onto at most 2 lines so it never overflows the frame width. */
export function wrapCaptionLines(text: string, maxCharsPerLine = 20): string[] {
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
  return lines.slice(0, 2);
}

/**
 * Renders the caption as a transparent PNG instead of using ffmpeg's
 * drawtext filter, then composited in with the same `overlay` filter already
 * used for the GIF layer. drawtext requires ffmpeg to have been compiled
 * with freetype support, and ffmpeg-static's Linux binary — confirmed
 * directly from a failed production render, not assumed — does not have it:
 * "No such filter: 'drawtext'". overlay has no such dependency, so this
 * works on any ffmpeg build.
 */
export async function renderCaptionImage(caption: string): Promise<Buffer> {
  const lines = wrapCaptionLines(caption);

  const image = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.45)",
            padding: "14px 24px",
          }}
        >
          {lines.map((line, i) => (
            <div
              key={i}
              style={{
                color: "white",
                fontSize: 48,
                fontWeight: 700,
                lineHeight: 1.25,
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: CANVAS_WIDTH, height: CANVAS_HEIGHT }
  );

  const arrayBuffer = await image.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
