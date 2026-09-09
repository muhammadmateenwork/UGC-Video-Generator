import type { PipelineStage } from "@/lib/types";
import { CheckIcon, FilmIcon, LayersIcon, LinkIcon, UploadIcon, WandIcon } from "./icons";

const STAGES: { id: PipelineStage; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
  { id: "scrape", label: "Read", icon: LinkIcon },
  { id: "plan", label: "Plan", icon: WandIcon },
  { id: "source", label: "Source", icon: LayersIcon },
  { id: "render", label: "Render", icon: FilmIcon },
  { id: "upload", label: "Upload", icon: UploadIcon },
];

/**
 * Mirrors the actual pipeline phases (scrape → plan → source → render →
 * upload) so the wait for a render feels like visible progress through a
 * known sequence, not an indeterminate spinner.
 */
export function PipelineStepper({ text, stage }: { text: string; stage?: PipelineStage }) {
  const currentIndex = stage ? STAGES.findIndex((s) => s.id === stage) : -1;

  return (
    <div className="flex flex-col gap-2.5 py-0.5">
      <div className="flex items-center gap-1">
        {STAGES.map((s, i) => {
          const done = currentIndex >= 0 && i < currentIndex;
          const active = i === currentIndex;
          return (
            <div key={s.id} className="flex items-center">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${
                  done
                    ? "border-accent bg-accent text-white"
                    : active
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border bg-surface text-ink-soft/40"
                }`}
              >
                {done ? (
                  <CheckIcon className="h-3 w-3" />
                ) : (
                  <s.icon className={`h-3 w-3 ${active ? "animate-pulse-dot" : ""}`} />
                )}
              </div>
              {i < STAGES.length - 1 && (
                <div
                  className={`h-px w-4 transition-colors sm:w-6 ${
                    done ? "bg-accent" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-ink-soft">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
        </span>
        <span className="text-[14px]">{text}</span>
      </div>
    </div>
  );
}
