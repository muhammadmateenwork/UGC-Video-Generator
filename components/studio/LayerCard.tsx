"use client";

import { useRef, useState } from "react";
import type { LayerDTO } from "@/lib/dto";
import { TRACKS } from "@/lib/layerMeta";
import { Switch } from "./controls";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalIcon,
  PauseIcon,
  PlayIcon,
  SearchIcon,
  Spinner,
} from "../icons";

type Kind = "background" | "gif" | "audio";

/** One-click searches for a layer that came back empty — the way out shouldn't require typing. */
const QUICK_PICKS: Record<Kind, string[]> = {
  background: ["lifestyle", "city street", "morning routine", "nature"],
  gif: ["wow", "mind blown", "yes", "happy dance"],
  audio: ["upbeat", "lofi", "chill", "energetic"],
};

export function LayerCard({
  kind,
  layer,
  busy,
  disabled,
  error,
  onSwap,
  enabled,
  onToggle,
  children,
}: {
  kind: Kind;
  layer?: LayerDTO;
  busy: boolean;
  disabled: boolean;
  error?: string | null;
  onSwap: (opts: { query?: string; step?: 1 | -1 }) => void;
  /** Omitted for layers that can't be switched off (the background). */
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  /** Layer-specific controls (size, volume) shown under the preview. */
  children?: React.ReactNode;
}) {
  const off = enabled === false;
  const meta = TRACKS[kind];
  const [query, setQuery] = useState(layer?.query ?? "");
  const [syncedQuery, setSyncedQuery] = useState(layer?.query);
  // Keep the input in step with the server's query after a swap, without an effect.
  if (layer?.query !== syncedQuery) {
    setSyncedQuery(layer?.query);
    setQuery(layer?.query ?? "");
  }
  const locked = busy || disabled;

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-line bg-card"
      style={{ boxShadow: `inset 3px 0 0 ${meta.color}` }}
      aria-busy={busy}
    >
      <header className="flex items-center gap-2 px-4 pt-3.5">
        <h3 className="text-[14px] font-semibold">{meta.label}</h3>
        <span className="font-mono text-[11px] text-ink-3">{meta.source}</span>
        {layer && (
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSwap({ step: -1 })}
              disabled={locked}
              aria-label={`Previous ${meta.label}`}
              className="grid h-7 w-7 place-items-center rounded-full text-ink-2 transition hover:bg-paper-2 disabled:opacity-30"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <span className="min-w-[42px] text-center font-mono text-[11px] text-ink-3 tnum">
              {layer.candidateIndex + 1}/{layer.total ?? "?"}
            </span>
            <button
              type="button"
              onClick={() => onSwap({ step: 1 })}
              disabled={locked}
              aria-label={`Next ${meta.label}`}
              className="grid h-7 w-7 place-items-center rounded-full text-ink-2 transition hover:bg-paper-2 disabled:opacity-30"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}
        {onToggle && (
          <span className={layer ? "ml-1" : "ml-auto"}>
            <Switch label={meta.label} checked={!off} disabled={disabled} color={meta.color} onChange={onToggle} />
          </span>
        )}
      </header>
      <div className={off ? "pointer-events-none opacity-40" : ""}>

      <div className="px-4 pt-3">
        {layer ? (
          <Preview kind={kind} layer={layer} />
        ) : (
          <div className="flex h-auto flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-line px-3 py-5 text-center">
            <p className="text-[13px] text-ink-3">Nothing found for this one yet. Try a quick pick:</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {QUICK_PICKS[kind].map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={locked}
                  onClick={() => onSwap({ query: q })}
                  className="rounded-full border border-line bg-paper px-2.5 py-1 text-[12px] transition hover:border-ink disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {layer?.creditName && (
          <a
            href={layer.creditUrl ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex max-w-full items-center gap-1 text-[12px] text-ink-3 hover:text-ink"
          >
            <span className="truncate">
              {layer.title && kind !== "background" ? `${layer.title} · ` : ""}by {layer.creditName}
            </span>
            <ExternalIcon className="h-3 w-3 shrink-0" />
          </a>
        )}
      </div>

      {children && <div className="space-y-2 px-4 pt-3">{children}</div>}

      <form
        className="flex items-center gap-2 px-4 pt-2 pb-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim() && !locked) onSwap({ query: query.trim() });
        }}
      >
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-paper px-2.5 focus-within:border-ink">
          <SearchIcon className="h-3.5 w-3.5 shrink-0 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={60}
            placeholder={`Search ${meta.source}`}
            aria-label={`${meta.label} search`}
            className="min-w-0 flex-1 bg-transparent text-[13px] focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={locked || !query.trim() || query.trim() === layer?.query}
          className="h-9 rounded-lg border border-ink px-3 text-[13px] font-medium transition hover:bg-ink hover:text-paper disabled:border-line disabled:text-ink-3 disabled:hover:bg-transparent"
        >
          Search
        </button>
      </form>
      </div>

      {error && (
        <p role="alert" className="-mt-2 px-4 pb-3 text-[12px] text-rec">
          {error}
        </p>
      )}

      {busy && (
        <div className="absolute inset-0 grid place-items-center bg-card/70 backdrop-blur-[1px]">
          <Spinner className="h-5 w-5 text-ink-2" />
        </div>
      )}
    </section>
  );
}

function Preview({ kind, layer }: { kind: Kind; layer: LayerDTO }) {
  if (kind === "audio") return <AudioPreview layer={layer} />;
  if (layer.mediaType === "video") {
    return (
      <video
        key={layer.previewUrl}
        src={layer.previewUrl}
        poster={layer.thumbUrl ?? undefined}
        muted
        loop
        autoPlay
        playsInline
        preload="metadata"
        className="h-36 w-full rounded-xl bg-ink object-cover"
      />
    );
  }
  return (
    <div className="grid h-36 place-items-center overflow-hidden rounded-xl bg-paper-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={layer.previewUrl}
        alt={layer.title ?? ""}
        className={kind === "gif" ? "h-full w-auto object-contain" : "h-full w-full object-cover"}
      />
    </div>
  );
}

function AudioPreview({ layer }: { layer: LayerDTO }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const duration = typeof layer.meta.duration === "number" ? layer.meta.duration : null;

  return (
    <div className="flex h-16 items-center gap-3 rounded-xl bg-paper-2 px-3">
      <button
        type="button"
        onClick={() => {
          const el = ref.current;
          if (!el) return;
          if (el.paused) el.play().catch(() => {});
          else el.pause();
        }}
        aria-label={playing ? "Pause audio" : "Play audio"}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white transition hover:brightness-110"
        style={{ background: TRACKS.audio.color }}
      >
        {playing ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="ml-0.5 h-4 w-4" />}
      </button>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium">{layer.title}</p>
        {duration !== null && <p className="font-mono text-[11px] text-ink-3">{duration.toFixed(1)}s source</p>}
      </div>
      <audio
        ref={ref}
        key={layer.previewUrl}
        src={layer.previewUrl}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}
