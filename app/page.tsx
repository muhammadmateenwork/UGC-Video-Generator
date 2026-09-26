import Link from "next/link";
import { connection } from "next/server";
import { NewProjectForm } from "@/components/NewProjectForm";
import { VideoCard } from "@/components/VideoCard";
import { Anatomy } from "@/components/home/Anatomy";
import { HowItWorks } from "@/components/home/HowItWorks";
import { PlusIcon } from "@/components/icons";
import { listRecentRendered, loadShowcase, loadStageTimings } from "@/lib/queries";

/** Home degrades to a still-useful page if the database is unreachable, instead of an error screen. */
async function loadHome() {
  try {
    const [items, showcase, timings] = await Promise.all([listRecentRendered(9), loadShowcase(), loadStageTimings()]);
    return { items, showcase, timings, dbError: false };
  } catch (err) {
    console.error("[home] database queries failed:", err);
    return { items: [], showcase: null, timings: {}, dbError: true };
  }
}

export default async function Home() {
  // Everything here is live data from the database — never prerender it at build time.
  await connection();
  const { items, showcase, timings, dbError } = await loadHome();

  return (
    <main className="mx-auto max-w-[1440px] px-4 sm:px-6">
      {/* Sized to the first screen, so the input and the diagram arrive together. */}
      <section className="grid items-center gap-10 py-10 lg:min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:py-8">
        <div className="animate-rise">
          <p className="font-mono text-[12px] tracking-[0.14em] text-ink-3 uppercase">
            Product link <span className="text-rec">→</span> 7-second vertical ad
          </p>
          <h1 className="mt-5 font-serif text-[56px] leading-[0.95] tracking-[-0.02em] sm:text-[76px] xl:text-[96px]">
            Paste a link.
            <br />
            Get the <em className="text-rec">ad.</em>
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-2">
            Cutroom reads your product page, plans one idea, and cuts a UGC-style video from real footage, a
            reaction GIF and music. Then you arrange every layer yourself before it renders.
          </p>
          <div className="mt-8 max-w-xl">
            <NewProjectForm />
          </div>
        </div>

        <Anatomy showcase={showcase} />
      </section>

      <div className="rule-dotted" />
      <HowItWorks timings={timings} />
      <div className="rule-dotted" />

      <section className="py-12 sm:py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-4xl tracking-tight sm:text-5xl">Recently cut</h2>
            <p className="mt-2 text-ink-3">Real renders from this app&apos;s database. Hover to play.</p>
          </div>
          {items.length > 0 && <span className="font-mono text-[12px] text-ink-3">{items.length} shown</span>}
        </div>

        {dbError ? (
          <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
            <p className="font-serif text-2xl">The database isn&apos;t reachable</p>
            <p className="mt-2 text-sm text-ink-3">Check DATABASE_URL in .env.local, then run pnpm db:migrate.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((p) => (
              <VideoCard key={p.id} project={p} href={`/v/${p.id}`} />
            ))}
            {/* An open slot keeps a young wall from looking empty, and doubles as the call to action. */}
            <Link
              href="/#new"
              className="group flex aspect-[9/16] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-line text-center transition hover:border-rec hover:bg-card"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-ink text-paper transition group-hover:bg-rec">
                <PlusIcon className="h-5 w-5" />
              </span>
              <span className="px-4 font-serif text-[22px] leading-tight">
                {items.length ? "Yours next" : "Be the first cut"}
              </span>
              <span className="px-6 text-[12px] text-ink-3">Paste a product link at the top</span>
            </Link>
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
