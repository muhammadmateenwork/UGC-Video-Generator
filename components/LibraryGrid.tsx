"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProjectSummaryDTO } from "@/lib/dto";
import { deleteProject } from "@/lib/client";
import { TrashIcon } from "./icons";

const STATUS_LABEL: Record<ProjectSummaryDTO["status"], string> = {
  draft: "Queued",
  preparing: "Preparing",
  ready: "Not rendered",
  rendering: "Rendering",
  rendered: "Rendered",
  failed: "Failed",
};

function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function LibraryGrid({ initial }: { initial: ProjectSummaryDTO[] }) {
  const [items, setItems] = useState(initial);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function remove(id: string) {
    const before = items;
    setItems((xs) => xs.filter((x) => x.id !== id)); // optimistic
    setConfirming(null);
    try {
      await deleteProject(id);
    } catch {
      setItems(before);
    }
  }

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((p) => (
        <li key={p.id} className="group relative">
          <Link href={`/p/${p.id}`} className="block">
            <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-ink ring-1 ring-ink/10 transition group-hover:-translate-y-0.5">
              {p.videoUrl ? (
                <video
                  src={p.videoUrl}
                  poster={p.thumbUrl ?? undefined}
                  muted
                  loop
                  playsInline
                  preload="none"
                  onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                  onMouseLeave={(e) => e.currentTarget.pause()}
                  className="h-full w-full object-cover"
                />
              ) : p.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.thumbUrl} alt="" className="h-full w-full object-cover opacity-60" />
              ) : null}
              <span
                className={`absolute top-2 left-2 rounded-full px-2 py-0.5 font-mono text-[10px] backdrop-blur ${
                  p.status === "rendered"
                    ? "bg-paper/90 text-ink"
                    : p.status === "failed"
                      ? "bg-rec text-white"
                      : "bg-ink/70 text-paper"
                }`}
              >
                {STATUS_LABEL[p.status]}
              </span>
            </div>
            <p className="mt-2.5 truncate text-[14px] font-medium">{p.caption || p.title || p.domain}</p>
            <p className="truncate font-mono text-[12px] text-ink-3">
              {p.domain} · {timeAgo(p.createdAt)}
            </p>
          </Link>

          <div className="absolute top-2 right-2">
            {confirming === p.id ? (
              <div className="flex gap-1">
                <button
                  onClick={() => remove(p.id)}
                  className="rounded-full bg-rec px-2.5 py-1 text-[11px] font-medium text-white"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  className="rounded-full bg-paper/90 px-2.5 py-1 text-[11px] font-medium"
                >
                  Keep
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(p.id)}
                aria-label={`Delete ${p.domain}`}
                className="grid h-7 w-7 place-items-center rounded-full bg-paper/90 text-ink opacity-0 transition group-hover:opacity-100 focus:opacity-100"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
