import { COMPOSITION, DEFAULT_LAYOUT, captionCss, wrapCaptionLines } from "@/lib/composition";
import { TRACKS, TRACK_ORDER } from "@/lib/layerMeta";
import type { Showcase } from "@/lib/queries";

const PLANE_W = 210;
/** Render pixels → plane pixels. */
const K = PLANE_W / COMPOSITION.width;

const FALLBACK: Showcase = {
  domain: "yourproduct.com",
  caption: "your product, but viral",
  captionStyle: "box",
  layout: DEFAULT_LAYOUT,
  backgroundThumb: null,
  gifUrl: null,
};

/**
 * The product explained as a picture: the latest real cut from the database,
 * pulled apart into its four layers and slowly re-assembling. Every layer
 * is placed from that video's saved layout with the renderer's own
 * captionCss — it's the actual composition, just exploded.
 */
export function Anatomy({ showcase }: { showcase: Showcase | null }) {
  const s = showcase ?? FALLBACK;
  const c = s.layout.caption;
  const g = s.layout.gif;
  const css = captionCss(s.captionStyle, (px) => `${(px * K * c.scale).toFixed(2)}px`, c);

  return (
    <div className="relative mx-auto w-full max-w-[420px]" aria-hidden>
      <div className="relative h-[430px] [perspective:1400px]">
        <div className="anatomy absolute inset-0 [transform:rotateX(55deg)_rotateZ(-34deg)] [transform-style:preserve-3d]">
          {TRACK_ORDER.map((id, i) => (
            <div
              key={id}
              className="absolute top-2 left-1/2 aspect-[9/16] -translate-x-1/2 overflow-hidden rounded-[18px] border-2"
              style={{
                width: PLANE_W,
                borderColor: TRACKS[id].color,
                transform: `translateZ(calc(var(--spread) * ${i}))`,
                background:
                  i === 0 ? "var(--ink)" : `color-mix(in srgb, ${TRACKS[id].color} 7%, transparent)`,
              }}
            >
              {id === "background" && s.backgroundThumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.backgroundThumb} alt="" className="h-full w-full object-cover" />
              )}
              {id === "caption" && c.enabled && s.caption && (
                <div
                  className="absolute flex justify-center"
                  style={{ top: `${c.y * 100}%`, left: `${(c.x - 0.5) * 100}%`, width: "100%" }}
                >
                  <div style={css.box}>
                    {wrapCaptionLines(s.caption).map((line, j) => (
                      <span key={j} style={{ ...css.line, fontFamily: "var(--font-caption)" }}>
                        {line}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {id === "gif" && g.enabled && (
                <div
                  className="absolute overflow-hidden rounded-[3px]"
                  style={{
                    width: g.width * K,
                    left: `${g.x * 100 - (g.width / COMPOSITION.width) * 50}%`,
                    top: `${g.y * 100}%`,
                  }}
                >
                  {s.gifUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.gifUrl} alt="" className="block w-full" />
                  ) : (
                    <div className="aspect-[4/3] w-full" style={{ background: TRACKS.gif.color }} />
                  )}
                </div>
              )}
              {id === "audio" && (
                <div className="absolute inset-x-4 bottom-5 flex h-9 items-end gap-[3px]">
                  {[5, 9, 4, 12, 7, 14, 6, 10, 3, 8, 13, 5, 9, 6, 11, 4].map((h, j) => (
                    <span key={j} className="flex-1 rounded-full" style={{ height: h * 2.2, background: TRACKS.audio.color }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <ul className="-mt-2 grid grid-cols-2 gap-x-6 gap-y-3">
        {TRACK_ORDER.map((id) => (
          <li key={id} className="flex gap-2.5">
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TRACKS[id].color }} />
            <span>
              <span className="block text-[13px] font-medium">
                {TRACKS[id].label}{" "}
                <span className="font-mono text-[11px] font-normal text-ink-3">· {TRACKS[id].source}</span>
              </span>
              <span className="block text-[12px] leading-snug text-ink-3">{TRACKS[id].blurb}</span>
            </span>
          </li>
        ))}
      </ul>
      {showcase && (
        <p className="mt-4 font-mono text-[11px] text-ink-3">
          Exploded: the latest real cut, for {showcase.domain}
        </p>
      )}
    </div>
  );
}
