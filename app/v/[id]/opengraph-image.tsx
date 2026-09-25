import { ImageResponse } from "next/og";
import { captionCss, wrapCaptionLines } from "@/lib/composition";
import { loadFont } from "@/lib/fonts";
import { loadProject } from "@/lib/pipeline";
import { uuidSchema } from "@/lib/http";

export const alt = "A 7-second UGC ad made with Cutroom";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#f2efe7";
const INK = "#161513";
const LAYER_COLORS = ["#2f64ff", "#ff5b24", "#d2379b", "#0f9a55"];

/**
 * The card a /v/ link unfurls into on Slack, X, LinkedIn or WhatsApp: the
 * video's own frame with its caption in its chosen style, next to the
 * product name. Built from the same captionCss as the MP4, scaled down.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = uuidSchema.safeParse(id).success ? await loadProject(id, null) : null;
  const [inter, serif] = await Promise.all([loadFont("interExtraBold"), loadFont("instrumentSerif")]);

  const title = project?.title || project?.domain || "Cutroom";
  const caption = project?.caption ?? "";
  const thumb = project?.layers.background?.thumbUrl ?? null;
  // The phone frame is 300px wide; the render is 720px wide.
  const scale = 300 / 720;
  const css = captionCss(project?.captionStyle ?? "box", (px) => `${(px * scale).toFixed(2)}px`);

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: PAPER, padding: 56, gap: 64 }}>
        <div
          style={{
            display: "flex",
            position: "relative",
            width: 300,
            height: 518,
            borderRadius: 28,
            overflow: "hidden",
            background: INK,
            boxShadow: "0 30px 60px -30px rgba(22,21,19,0.6)",
          }}
        >
          {thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" width={300} height={518} style={{ objectFit: "cover", width: 300, height: 518 }} />
          )}
          {caption && (
            <div style={{ position: "absolute", top: 46, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
              <div style={css.box}>
                {wrapCaptionLines(caption).map((line, i) => (
                  <div key={i} style={{ ...css.line, fontFamily: "Inter" }}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between", paddingTop: 8 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 20, letterSpacing: 3, color: "#8a857a" }}>
              A 7-SECOND AD FOR {project?.domain.toUpperCase() ?? "YOUR PRODUCT"}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 22,
                fontFamily: "Instrument Serif",
                fontSize: title.length > 40 ? 64 : 84,
                lineHeight: 1,
                color: INK,
                letterSpacing: -1.5,
              }}
            >
              {title.length > 70 ? `${title.slice(0, 67)}…` : title}
            </div>
            {project?.angle && (
              <div
                style={{
                  display: "flex",
                  marginTop: 24,
                  fontFamily: "Instrument Serif",
                  fontStyle: "normal",
                  fontSize: 34,
                  lineHeight: 1.2,
                  color: "#4f4b44",
                }}
              >
                “{project.angle}”
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", width: 22, height: 32, borderRadius: 5, background: INK }} />
              <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 40, color: INK }}>Cutroom</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {LAYER_COLORS.map((c) => (
                <div key={c} style={{ display: "flex", width: 18, height: 18, borderRadius: 9, background: c }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: inter, weight: 800, style: "normal" },
        { name: "Instrument Serif", data: serif, weight: 400, style: "normal" },
      ],
    }
  );
}
