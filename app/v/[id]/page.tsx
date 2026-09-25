import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getOwnerId } from "@/lib/owner";
import { loadProject } from "@/lib/pipeline";
import { uuidSchema } from "@/lib/http";
import { TRACKS } from "@/lib/layerMeta";
import { ArrowRightIcon, ExternalIcon } from "@/components/icons";

// generateMetadata and the page both need the project; dedupe the DB read.
const getProject = cache(async (id: string) => {
  if (!uuidSchema.safeParse(id).success) return null;
  const p = await loadProject(id, await getOwnerId());
  return p?.videoUrl ? p : null;
});

export async function generateMetadata(props: PageProps<"/v/[id]">): Promise<Metadata> {
  const p = await getProject((await props.params).id);
  if (!p) return { title: "Not found" };
  const title = p.caption ? `"${p.caption}" — ${p.domain}` : p.domain;
  return {
    title,
    description: `A 7-second UGC ad for ${p.title || p.domain}, cut with Cutroom.`,
    openGraph: { title, type: "video.other", videos: p.videoUrl ? [{ url: p.videoUrl }] : undefined },
  };
}

/** Public, read-only page for one finished video — what a share link opens. */
export default async function SharePage(props: PageProps<"/v/[id]">) {
  const p = await getProject((await props.params).id);
  if (!p) notFound();

  const credits = (["background", "gif", "audio"] as const)
    .map((k) => ({ k, l: p.layers[k] }))
    .filter((x) => x.l?.creditName);

  return (
    <main className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-10 sm:px-6 md:grid-cols-[360px_1fr] md:gap-16 md:py-16">
      <video
        src={p.videoUrl!}
        controls
        autoPlay
        muted
        loop
        playsInline
        className="mx-auto aspect-[9/16] w-full max-w-[360px] rounded-[22px] bg-ink shadow-[0_30px_60px_-30px_rgba(22,21,19,0.6)]"
      />
      <div>
        <p className="font-mono text-[12px] tracking-[0.14em] text-ink-3 uppercase">A Cutroom ad for</p>
        <h1 className="mt-3 font-serif text-5xl leading-[1] tracking-tight sm:text-6xl">{p.title || p.domain}</h1>
        {p.angle && <p className="mt-5 font-serif text-2xl leading-snug text-ink-2 italic">&ldquo;{p.angle}&rdquo;</p>}
        <a
          href={p.url}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 font-mono text-[13px] text-ink-2 hover:text-ink"
        >
          {p.domain} <ExternalIcon className="h-3.5 w-3.5" />
        </a>

        {credits.length > 0 && (
          <dl className="mt-8 space-y-2 border-t border-line pt-5 text-[13px]">
            {credits.map(({ k, l }) => (
              <div key={k} className="flex gap-3">
                <dt className="flex w-28 shrink-0 items-center gap-2 text-ink-3">
                  <span className="h-2 w-2 rounded-full" style={{ background: TRACKS[k].color }} />
                  {TRACKS[k].label}
                </dt>
                <dd className="min-w-0 truncate">
                  <a href={l!.creditUrl ?? undefined} target="_blank" rel="noreferrer" className="hover:underline">
                    {l!.creditName}
                  </a>{" "}
                  <span className="text-ink-3">on {TRACKS[k].source}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-8 flex flex-wrap gap-2">
          {p.isOwner && (
            <Link
              href={`/p/${p.id}`}
              className="inline-flex h-11 items-center rounded-full border border-line px-5 text-[15px] font-medium hover:border-ink"
            >
              Edit in studio
            </Link>
          )}
          <Link
            href="/#new"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-rec px-5 text-[15px] font-medium text-white hover:brightness-105"
          >
            Make one for your product <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </main>
  );
}
