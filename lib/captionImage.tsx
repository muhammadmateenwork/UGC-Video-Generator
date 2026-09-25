import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { COMPOSITION, wrapCaptionLines } from "./composition";

export { wrapCaptionLines };

const C = COMPOSITION.caption;

// next/og only bundles a regular-weight font, so fontWeight: 700 silently
// rendered thin — caught by comparing a real render against the studio
// preview side by side. Loading the same Inter ExtraBold the preview uses
// makes the two actually match. (Satori reads woff/ttf, not woff2.)
let fontData: Promise<Buffer> | null = null;
function captionFont() {
  fontData ??= readFile(path.join(process.cwd(), "assets", "fonts", "Inter-ExtraBold.woff"));
  return fontData;
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
  const font = await captionFont();

  const image = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: COMPOSITION.width,
          height: C.canvasHeight,
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: C.paddingTop,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            backgroundColor: C.boxColor,
            padding: `${C.padY}px ${C.padX}px`,
          }}
        >
          {lines.map((line, i) => (
            <div
              key={i}
              style={{
                color: "white",
                fontSize: C.fontSize,
                fontFamily: "Inter",
                fontWeight: C.fontWeight,
                letterSpacing: C.letterSpacing,
                lineHeight: C.lineHeight,
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: COMPOSITION.width,
      height: C.canvasHeight,
      fonts: [{ name: "Inter", data: font, weight: C.fontWeight, style: "normal" }],
    }
  );

  const arrayBuffer = await image.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
