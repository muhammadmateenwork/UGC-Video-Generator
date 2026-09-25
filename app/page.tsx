import { connection } from "next/server";
import { NewProjectForm } from "@/components/NewProjectForm";
import { VideoCard } from "@/components/VideoCard";
import { listRecentRendered } from "@/lib/queries";
import { TRACKS, TRACK_ORDER } from "@/lib/layerMeta";
import type { ProjectSummaryDTO } from "@/lib/dto";

async function loadWall(): Promise<{ items: ProjectSummaryDTO[]; dbError: boolean }> {
  try {
    return { items: await listRecentRendered(10), dbError: false };
  } catch (err) {
    console.error("[home] wall query failed:", err);
    return { items: [], dbError: true };
  }
}

export default async function Home() {
  // The wall is live data from the database — never prerender it at build time.
  await connection();
  const { items, dbError } = await loadWall();
  const hero = items.find((p) => p.thumbUrl)?.thumbUrl ?? null;

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6">
      <section className="grid items-center gap-12 py-12 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:py-20">
        <div className="animate-rise">
          <p className="font-mono text-[12px] tracking-[0.14em] text-ink-3 uppercase">
            Product link <span className="text-rec">→</span> 7-second vertical ad
          </p>
          <h1 className="mt-5 font-serif text-[56px] leading-[0.95] tracking-[-0.02em] sm:text-[80px] lg:text-[96px]">
            Paste a link.
            <br />
            Get the <em className="text-rec">ad.</em>
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2">
            Cutroom reads your product page, plans one idea, and cuts a UGC-style video from real footage, a
            reaction GIF and music. Every layer stays editable, so you can swap any of them before it renders.
          </p>
          <div className="mt-8 max-w-xl">
            <NewProjectForm />
          </div>
        </div>

        <Anatomy image={hero} />
      </section>

      <div className="rule-dotted" />

      <section className="py-12 sm:py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-4xl tracking-tight sm:text-5xl">Recently cut</h2>
            <p className="mt-2 text-ink-3">Real renders from this app&apos;s database. Hover to play.</p>
          </div>
          <span className="hidden font-mono text-[12px] text-ink-3 sm:block">{items.length} shown</span>
        </div>

        {items.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((p) => (
              <VideoCard key={p.id} project={p} href={`/v/${p.id}`} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
            <p className="font-serif text-2xl">{dbError ? "The database isn't reachable" : "Nothing on the wall yet"}</p>
            <p className="mt-2 text-sm text-ink-3">
              {dbError
                ? "Check DATABASE_URL in .env.local, then run pnpm db:migrate."
                : "Paste a product link above. Your render will be the first one here."}
            </p>
          </div>
        )}
      </section>

      <footer className="flex flex-col gap-2 border-t border-line py-8 font-mono text-[12px] text-ink-3 sm:flex-row sm:justify-between">
        <span>Next.js 16 · Neon Postgres · Drizzle · ffmpeg · Gemini</span>
        <span>Footage by Pexels · GIFs by Giphy · Audio by Freesound</span>
      </footer>
    </main>
  );
}

/**
 * The product explained as a picture instead of a feature list: the four
 * layers of every video, pulled apart. Each layer is drawn in the same
 * colour it uses in the studio's timeline.
 */
function Anatomy({ image }: { image: string | null }) {
  return (
    <div className="relative mx-auto hidden w-full max-w-[440px] lg:block" aria-hidden>
      <div className="relative h-[520px] [perspective:1400px]">
        <div className="absolute inset-0 [transform:rotateX(52deg)_rotateZ(-32deg)] [transform-style:preserve-3d]">
          {TRACK_ORDER.map((id, i) => (
            <div
              key={id}
              className="absolute top-8 left-1/2 aspect-[9/16] w-[220px] -translate-x-1/2 rounded-2xl border-2 transition-transform"
              style={{
                borderColor: TRACKS[id].color,
                transform: `translateZ(${i * 64}px)`,
                background: i === 0 ? "var(--ink)" : "color-mix(in srgb, var(--card) 18%, transparent)",
              }}
            >
              {id === "background" && image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="h-full w-full rounded-[14px] object-cover opacity-90" />
              )}
              {id === "caption" && (
                <div className="mx-auto mt-6 w-3/4 rounded-sm px-2 py-1.5" style={{ background: TRACKS.caption.color }} />
              )}
              {id === "gif" && (
                <div
                  className="absolute right-3 bottom-16 aspect-square w-1/3 rounded-md"
                  style={{ background: TRACKS.gif.color }}
                />
              )}
              {id === "audio" && (
                <div className="absolute inset-x-4 bottom-5 flex h-8 items-end gap-[3px]">
                  {[5, 9, 4, 12, 7, 14, 6, 10, 3, 8, 13, 5, 9, 6].map((h, j) => (
                    <span key={j} className="flex-1 rounded-full" style={{ height: h * 2, background: TRACKS.audio.color }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-3">
        {TRACK_ORDER.map((id) => (
          <li key={id} className="flex gap-2.5">
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TRACKS[id].color }} />
            <span>
              <span className="block text-sm font-medium">
                {TRACKS[id].label} <span className="font-mono text-[11px] font-normal text-ink-3">· {TRACKS[id].source}</span>
              </span>
              <span className="block text-[13px] leading-snug text-ink-3">{TRACKS[id].blurb}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
