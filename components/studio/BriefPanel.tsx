import type { EventDTO, ProjectDTO } from "@/lib/dto";
import { ExternalIcon } from "../icons";

function fmtMs(ms: number | null) {
  if (ms === null) return "";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function fmtClock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

/** What the AI read, what it decided, and everything that happened since — the plan is never a black box. */
export function BriefPanel({ project, loading }: { project: ProjectDTO; loading: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-2xl border border-line bg-card">
        {project.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.imageUrl} alt="" className="h-32 w-full border-b border-line object-cover" />
        ) : loading ? (
          <div className="skeleton h-32 w-full" />
        ) : null}
        <div className="p-4">
          <p className="font-mono text-[11px] tracking-[0.12em] text-ink-3 uppercase">Source</p>
          {project.title ? (
            <h2 className="mt-1.5 line-clamp-2 text-[15px] leading-snug font-semibold">{project.title}</h2>
          ) : (
            <div className="skeleton mt-2 h-4 w-3/4 rounded" />
          )}
          <a
            href={project.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 font-mono text-[12px] text-ink-3 hover:text-ink"
          >
            {project.domain} <ExternalIcon className="h-3 w-3" />
          </a>
          {project.description && (
            <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-ink-2">{project.description}</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] tracking-[0.12em] text-ink-3 uppercase">The angle</p>
          {project.planSource && (
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                project.planSource === "gemini" ? "bg-paper-2 text-ink-2" : "bg-rec-soft text-rec"
              }`}
              title={project.planSource === "gemini" ? undefined : "Gemini was unavailable, so a generic plan was used"}
            >
              {project.planSource === "gemini" ? "planned by Gemini" : "fallback plan"}
            </span>
          )}
        </div>
        {project.angle ? (
          <p className="mt-2 font-serif text-[22px] leading-[1.15] italic">&ldquo;{project.angle}&rdquo;</p>
        ) : loading ? (
          <div className="mt-3 space-y-2">
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-2/3 rounded" />
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-ink-3">No angle. The fallback plan doesn&apos;t have one.</p>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-card p-4">
        <p className="font-mono text-[11px] tracking-[0.12em] text-ink-3 uppercase">Activity</p>
        <ol className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
          {project.events.length === 0 && <li className="text-[13px] text-ink-3">Nothing yet.</li>}
          {[...project.events].reverse().map((e: EventDTO) => (
            <li key={e.id} className="grid grid-cols-[56px_1fr] gap-2 text-[12px] leading-snug">
              <span className="font-mono text-ink-3 tnum">{fmtClock(e.createdAt)}</span>
              <span className={e.level === "error" ? "text-rec" : e.level === "warn" ? "text-[#b25e00]" : "text-ink-2"}>
                <span className="font-mono text-ink">{e.stage}</span> {e.message}
                {e.durationMs !== null && <span className="font-mono text-ink-3"> · {fmtMs(e.durationMs)}</span>}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
