import { ImageResponse } from "next/og";
import { loadFont } from "./fonts";
import {
  COMPOSITION,
  DEFAULT_LAYOUT,
  captionCss,
  wrapCaptionLines,
  type CaptionStyle,
  type Layout,
} from "./composition";

export { wrapCaptionLines };

const C = COMPOSITION.caption;

// next/og only bundles a regular-weight font, so fontWeight: 700 silently
// rendered thin — caught by comparing a real render against the studio
// preview side by side. Using the same Inter ExtraBold the preview loads
// makes the two actually match.

/**
 * Renders the caption as a transparent PNG instead of using ffmpeg's
 * drawtext filter, then composited in with the same `overlay` filter already
 * used for the GIF layer. drawtext requires ffmpeg to have been compiled
 * with freetype support, and ffmpeg-static's Linux binary — confirmed
 * directly from a failed production render, not assumed — does not have it:
 * "No such filter: 'drawtext'". overlay has no such dependency, so this
 * works on any ffmpeg build.
 */
export async function renderCaptionImage(
  caption: string,
  style: CaptionStyle = "box",
  layout: Layout["caption"] = DEFAULT_LAYOUT.caption
): Promise<Buffer> {
  const lines = wrapCaptionLines(caption);
  const font = await loadFont("interExtraBold");
  const css = captionCss(style, (px) => `${(px * layout.scale).toFixed(2)}px`, layout);
  const W = COMPOSITION.width;

  // A full-frame transparent canvas with the caption placed on it, so
  // ffmpeg only ever overlays at 0,0 and all positioning lives here, in
  // the same fractions the preview uses. The row is one frame wide and
  // offset so its centre lands on layout.x.
  const image = new ImageResponse(
    (
      <div style={{ display: "flex", position: "relative", width: W, height: COMPOSITION.height }}>
        <div
          style={{
            position: "absolute",
            top: Math.round(layout.y * COMPOSITION.height),
            left: Math.round(layout.x * W - W / 2),
            width: W,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div style={css.box}>
            {lines.map((line, i) => (
              <div key={i} style={{ ...css.line, fontFamily: "Inter" }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: COMPOSITION.height,
      fonts: [{ name: "Inter", data: font, weight: C.fontWeight, style: "normal" }],
    }
  );

  const arrayBuffer = await image.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
