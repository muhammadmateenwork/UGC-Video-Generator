import type { StageTiming } from "@/lib/queries";

function fmt(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

type Step = { n: string; title: string; body: string; stages: string[] | null };

const STEPS: Step[] = [
  { n: "01", title: "Read", body: "Pulls the page's title, description and copy. Nothing to fill in.", stages: ["scrape"] },
  {
    n: "02",
    title: "Plan",
    body: "Gemini picks one angle, then writes the caption and the searches around it.",
    stages: ["plan"],
  },
  {
    n: "03",
    title: "Source",
    body: "Real footage, a reaction GIF and music, ranked and credited to their creators.",
    stages: ["source"],
  },
  {
    n: "04",
    title: "Arrange",
    body: "Swap, move, resize, recolour and retime any layer, with a live preview.",
    stages: null,
  },
  {
    n: "05",
    title: "Render",
    body: "ffmpeg cuts a 7-second 720×1280 MP4 exactly as the preview showed it.",
    stages: ["download", "render", "upload"],
  },
];

/**
 * The pipeline, with each step's median time measured from the activity
 * log of every run so far. When there's no data yet it says so instead of
 * inventing a number.
 */
export function HowItWorks({ timings }: { timings: Record<string, StageTiming> }) {
  return (
    <section className="py-12 sm:py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-serif text-4xl tracking-tight sm:text-5xl">How a cut is made</h2>
        <p className="font-mono text-[12px] text-ink-3">times are medians from this app&apos;s own activity log</p>
      </div>
      <ol className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((s) => {
          const measured = s.stages?.map((id) => timings[id]).filter(Boolean) ?? [];
          const total = measured.reduce((n, t) => n + t.medianMs, 0);
          const runs = measured.length ? Math.min(...measured.map((t) => t.runs)) : 0;
          return (
            <li key={s.n} className="flex flex-col bg-card p-5">
              <span className="font-mono text-[12px] text-rec">{s.n}</span>
              <h3 className="mt-3 font-serif text-[28px] leading-none">{s.title}</h3>
              <p className="mt-3 flex-1 text-[14px] leading-relaxed text-ink-2">{s.body}</p>
              <div className="mt-5 border-t border-line-2 pt-3">
                <p className="font-mono text-[18px] leading-none text-ink tnum">
                  {s.stages === null ? "you decide" : measured.length ? `~${fmt(total)}` : "—"}
                </p>
                <p className="mt-1.5 font-mono text-[11px] text-ink-3">
                  {s.stages === null
                    ? "no clock on this step"
                    : measured.length
                      ? `median of ${runs} run${runs === 1 ? "" : "s"}`
                      : "no runs yet"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
