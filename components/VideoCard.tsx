"use client";

import Link from "next/link";
import { useRef } from "react";
import type { ProjectSummaryDTO } from "@/lib/dto";

/** A 9:16 tile that plays its render on hover/focus — the wall should feel like a feed, not a file list. */
export function VideoCard({ project, href }: { project: ProjectSummaryDTO; href: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const play = () => videoRef.current?.play().catch(() => {});
  const stop = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };

  return (
    <Link
      href={href}
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
      className="group block"
    >
      <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-ink ring-1 ring-ink/10 transition group-hover:-translate-y-0.5 group-hover:shadow-[0_18px_40px_-20px_rgba(22,21,19,0.6)]">
        {project.videoUrl ? (
          <video
            ref={videoRef}
            src={project.videoUrl}
            poster={project.thumbUrl ?? undefined}
            muted
            loop
            playsInline
            preload="none"
            className="h-full w-full object-cover"
          />
        ) : project.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.thumbUrl} alt="" className="h-full w-full object-cover opacity-70" />
        ) : null}
      </div>
      <div className="mt-2.5 px-0.5">
        <p className="truncate text-[14px] leading-snug font-medium">{project.caption || project.title || project.domain}</p>
        <p className="truncate font-mono text-[12px] text-ink-3">{project.domain}</p>
      </div>
    </Link>
  );
}
