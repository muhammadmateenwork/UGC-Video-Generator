"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { COMPOSITION } from "@/lib/composition";
import { STALE_LOCK_MS, type ProjectDTO } from "@/lib/dto";
import type { Stage } from "@/lib/pipeline";
import { patchProject, runPipeline, swapLayer } from "@/lib/client";
import {
  CAPTION_STYLES,
  CAPTION_STYLE_META,
  LAYOUT_LIMITS,
  type CaptionStyle,
  type Layout,
} from "@/lib/composition";
import { Slider } from "./controls";
import { toast } from "../Toaster";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { BriefPanel } from "./BriefPanel";
import { CaptionCard } from "./CaptionCard";
import { LayerCard } from "./LayerCard";
import { PreviewCanvas } from "./PreviewCanvas";
import { Timeline } from "./Timeline";
import { formatTime, useClock } from "./useClock";
import {
  AlertIcon,
  CheckIcon,
  DownloadIcon,
  ExternalIcon,
  LinkIcon,
  MuteIcon,
  PauseIcon,
  PlayIcon,
  RetryIcon,
  Spinner,
  VolumeIcon,
} from "../icons";

type Kind = "background" | "gif" | "audio";
type Phase = "prepare" | "render";
type StageState = { state: "active" | "done"; ms?: number; message?: string };

const PHASE_STAGES: Record<Phase, { id: Stage; label: string }[]> = {
  prepare: [
    { id: "scrape", label: "Reading the page" },
    { id: "plan", label: "Planning one idea" },
    { id: "source", label: "Finding footage, GIF and audio" },
  ],
  render: [
    { id: "download", label: "Fetching the selected assets" },
    { id: "render", label: "Cutting with ffmpeg" },
    { id: "upload", label: "Saving the video" },
  ],
};

export function Studio({ initial }: { initial: ProjectDTO }) {
  const [project, setProject] = useState(initial);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [stages, setStages] = useState<Partial<Record<Stage, StageState>>>({});
  const [phaseError, setPhaseError] = useState<string | null>(null);
  const [busyLayer, setBusyLayer] = useState<Kind | null>(null);
  const [layerErrors, setLayerErrors] = useState<Partial<Record<Kind, string>>>({});
  const [captionDraft, setCaptionDraft] = useState(initial.caption ?? "");
  // The layout being edited: updated on every drag/slider tick for a live
  // preview, saved once per finished gesture (see changeLayout).
  const [layout, setLayout] = useState<Layout>(initial.layout);
  const layoutRef = useRef(initial.layout);
  const [view, setView] = useState<"preview" | "render">(
    initial.videoUrl && !initial.stale ? "render" : "preview"
  );
  const [muted, setMuted] = useState(true);
  const clock = useClock(COMPOSITION.duration, 1.5);
  const autoStarted = useRef(false);
  const [showKeys, setShowKeys] = useState(false);

  // Mirrors the server's lock takeover: a busy phase nobody is driving, whose
  // row hasn't changed in 90s, died (e.g. a serverless timeout) and can be retried.
  const stuck =
    phase === null &&
    (project.status === "preparing" || project.status === "rendering") &&
    project.idleMs > STALE_LOCK_MS;
  const preparing = phase === "prepare" || project.status === "draft" || (project.status === "preparing" && !stuck);
  const rendering = phase === "render" || (project.status === "rendering" && !stuck);
  const prepared = !!project.caption || Object.keys(project.layers).length > 0;

  async function run(next: Phase) {
    setPhase(next);
    setStages({});
    setPhaseError(null);
    let failed = false;
    try {
      await runPipeline(project.id, next, (e) => {
        if (e.type === "stage") {
          setStages((s) => ({
            ...s,
            [e.stage]: e.state === "start" ? { state: "active" } : { state: "done", ms: e.ms, message: e.message },
          }));
        } else if (e.type === "project") {
          setProject(e.project);
          setCaptionDraft(e.project.caption ?? "");
          setLayout(e.project.layout);
          layoutRef.current = e.project.layout;
        } else if (e.type === "error") {
          failed = true;
          setPhaseError(e.message);
        }
      });
      if (next === "render" && !failed) {
        setView("render");
        clock.setPlaying(false);
        toast("Your video is ready", "ok");
      }
      if (failed) toast(next === "render" ? "Render failed. Details are in the panel." : "Preparing failed", "error");
    } catch (err) {
      setPhaseError(err instanceof Error ? err.message : "Something went wrong");
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setPhase(null);
    }
  }

  // A brand-new project prepares itself as soon as the studio opens.
  useEffect(() => {
    if (autoStarted.current || !initial.isOwner || initial.status !== "draft") return;
    autoStarted.current = true;
    run("prepare");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opened mid-phase in another tab (or after a refresh)? Follow along from the database.
  useEffect(() => {
    if (phase || (project.status !== "preparing" && project.status !== "rendering")) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/projects/${project.id}`, { cache: "no-store" }).catch(() => null);
      if (!res?.ok) return;
      const { project: fresh } = (await res.json()) as { project: ProjectDTO };
      setProject(fresh);
      setCaptionDraft(fresh.caption ?? "");
      setLayout(fresh.layout);
      layoutRef.current = fresh.layout;
    }, 2000);
    return () => clearInterval(timer);
  }, [phase, project.status, project.id]);

  async function onSwap(kind: Kind, opts: { query?: string; step?: 1 | -1 }) {
    setBusyLayer(kind);
    setLayerErrors((e) => ({ ...e, [kind]: undefined }));
    try {
      setProject(await swapLayer(project.id, kind, opts));
      setView("preview");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't swap that";
      setLayerErrors((e) => ({ ...e, [kind]: message }));
      toast(message, "error");
    } finally {
      setBusyLayer(null);
    }
  }

  async function onSaveCaption(value: string) {
    setProject(await patchProject(project.id, { caption: value }));
  }

  /** Live update always; persist only when a gesture finishes (`commit`). */
  async function changeLayout(next: Layout, commit: boolean) {
    layoutRef.current = next;
    setLayout(next);
    if (!commit) return;
    setView("preview");
    try {
      const saved = await patchProject(project.id, { layout: next });
      setProject(saved);
    } catch (err) {
      setLayout(project.layout);
      layoutRef.current = project.layout;
      toast(err instanceof Error ? err.message : "Couldn't save that change", "error");
    }
  }
  const changePart = <K extends keyof Layout>(key: K, part: Layout[K], commit: boolean) =>
    changeLayout({ ...layoutRef.current, [key]: part }, commit);

  async function onCaptionStyle(style: CaptionStyle) {
    if (style === project.captionStyle) return;
    const previous = project;
    setProject({ ...project, captionStyle: style }); // optimistic — the preview switches instantly
    setView("preview");
    try {
      setProject(await patchProject(project.id, { captionStyle: style }));
    } catch (err) {
      setProject(previous);
      toast(err instanceof Error ? err.message : "Couldn't change the style", "error");
    }
  }

  const editable = project.isOwner && !preparing && !rendering;
  const showRender = view === "render" && !!project.videoUrl;
  const canRender = project.isOwner && !preparing && !rendering && busyLayer === null;

  // Editor-style shortcuts. useEffectEvent keeps the listener stable while
  // always seeing current state, so it is attached exactly once.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    // Some layouts/automation report Shift+/ as "/", so treat both as "?".
    const help = e.key === "?" || (e.key === "/" && e.shiftKey);
    if (showKeys && !help) return;
    const k = e.key.toLowerCase();
    const step = e.shiftKey ? -1 : 1;
    const swap = (kind: Kind) => editable && busyLayer === null && project.layers[kind] && onSwap(kind, { step });
    if (e.key === " ") {
      e.preventDefault();
      if (showRender) setView("preview");
      clock.setPlaying(!clock.playing);
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      if ((el as HTMLElement | null)?.getAttribute("role") === "slider") return; // the timeline handles its own
      e.preventDefault();
      clock.seek(clock.t + (e.key === "ArrowRight" ? 0.25 : -0.25));
    } else if (k === "m") setMuted((m) => !m);
    else if (k === "b") swap("background");
    else if (k === "g") swap("gif");
    else if (k === "a") swap("audio");
    else if (k === "c" && editable) {
      const i = CAPTION_STYLES.indexOf(project.captionStyle);
      const nextStyle = CAPTION_STYLES[(i + 1) % CAPTION_STYLES.length];
      onCaptionStyle(nextStyle);
      toast(`Caption style: ${CAPTION_STYLE_META[nextStyle].label}`);
    } else if (k === "r" && canRender) run("render");
    else if (help) setShowKeys((v) => !v);
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <main className="mx-auto max-w-[1440px] px-4 pt-5 pb-28 sm:px-6 lg:pb-16">
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href="/library" className="font-mono text-[12px] text-ink-3 hover:text-ink">
          Library /
        </Link>
        <h1 className="font-serif text-[28px] leading-tight tracking-tight">{project.title || project.domain}</h1>
        <StatusPill project={project} phase={phase} />
        <button
          onClick={() => setShowKeys(true)}
          className="ml-auto hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px] text-ink-3 transition hover:border-ink-3 hover:text-ink md:inline-flex"
        >
          <kbd className="font-mono">?</kbd> Shortcuts
        </button>
        {/* The primary action, always on the first screen on laptops; phones use the sticky bottom bar. */}
        {project.isOwner && prepared && (
          <button
            onClick={() => run("render")}
            disabled={!canRender}
            title="Render (R)"
            className={`hidden h-9 items-center gap-2 rounded-full px-4 text-[14px] font-medium transition active:scale-[0.98] disabled:opacity-60 lg:inline-flex ${
              project.videoUrl && !project.stale && !rendering
                ? "border border-line hover:border-ink"
                : "bg-rec text-white hover:brightness-105"
            }`}
          >
            {rendering ? (
              <>
                <Spinner /> Rendering
              </>
            ) : (
              <>
                {project.videoUrl && !project.stale ? (
                  <RetryIcon className="h-4 w-4" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-white" />
                )}
                {project.videoUrl ? (project.stale ? "Render again" : "Re-render") : "Render video"}
              </>
            )}
          </button>
        )}
      </div>
      <ShortcutsDialog open={showKeys} onClose={() => setShowKeys(false)} />

      {/* Phones: the two actions you need at any scroll position, like a native editor. */}
      {project.isOwner && prepared && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <button
              onClick={() => {
                if (showRender) setView("preview");
                clock.setPlaying(!clock.playing);
              }}
              aria-label={clock.playing ? "Pause preview" : "Play preview"}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-paper"
            >
              {clock.playing ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="ml-0.5 h-4 w-4" />}
            </button>
            <span className="font-mono text-[13px] tnum">{formatTime(clock.t)}</span>
            {rendering ? (
              <span className="ml-auto inline-flex h-11 items-center gap-2 rounded-full bg-ink/5 px-4 text-[14px] text-ink-2">
                <Spinner /> {PHASE_STAGES.render.find((s) => stages[s.id]?.state === "active")?.label ?? "Rendering"}
              </span>
            ) : project.videoUrl && !project.stale ? (
              <button
                onClick={async () => {
                  const url = `${window.location.origin}/v/${project.id}`;
                  if (navigator.share) await navigator.share({ url, title: project.title ?? project.domain }).catch(() => {});
                  else {
                    await navigator.clipboard.writeText(url).catch(() => {});
                    toast("Share link copied", "ok");
                  }
                }}
                className="ml-auto inline-flex h-11 items-center gap-2 rounded-full border border-ink px-5 text-[15px] font-medium"
              >
                <LinkIcon className="h-4 w-4" /> Share
              </button>
            ) : (
              <button
                onClick={() => run("render")}
                disabled={!canRender}
                className="ml-auto inline-flex h-11 items-center gap-2 rounded-full bg-rec px-5 text-[15px] font-medium text-white disabled:opacity-40"
              >
                <span className="h-2 w-2 rounded-full bg-white" />
                {project.videoUrl ? "Render again" : "Render video"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[290px_minmax(0,1fr)_360px]">
        {/* Center first in the DOM so it leads on mobile; the brief drops under it until there is room for three columns. */}
        <div className="flex min-w-0 flex-col gap-4 xl:order-2">
          {(preparing || (stuck && project.status === "preparing")) && !prepared ? (
            <PrepareView
              stages={stages}
              error={stuck ? "Preparing stopped responding." : phaseError}
              onRetry={() => run("prepare")}
            />
          ) : (
            <>
              <div className="flex flex-col items-center gap-3">
                {project.videoUrl && (
                  <div className="flex rounded-full border border-line bg-card p-0.5 text-[13px]" role="tablist">
                    {(["preview", "render"] as const).map((v) => (
                      <button
                        key={v}
                        role="tab"
                        aria-selected={view === v}
                        onClick={() => {
                          setView(v);
                          clock.setPlaying(false);
                        }}
                        className={`rounded-full px-3.5 py-1 transition ${
                          view === v ? "bg-ink text-paper" : "text-ink-3 hover:text-ink"
                        }`}
                      >
                        {v === "preview" ? "Live preview" : "Final render"}
                        {v === "render" && project.stale && <span className="ml-1.5 text-rec">•</span>}
                      </button>
                    ))}
                  </div>
                )}

                <div className="w-[228px] sm:w-[312px]">
                  {showRender ? (
                    <video
                      key={project.videoUrl}
                      src={project.videoUrl!}
                      controls
                      autoPlay
                      loop
                      playsInline
                      className="aspect-[9/16] w-full rounded-[20px] bg-ink"
                    />
                  ) : (
                    <PreviewCanvas
                      background={project.layers.background}
                      gif={project.layers.gif}
                      audio={project.layers.audio}
                      caption={captionDraft}
                      captionStyle={project.captionStyle}
                      layout={layout}
                      editable={editable}
                      onLayout={changeLayout}
                      t={clock.t}
                      playing={clock.playing}
                      muted={muted}
                    />
                  )}
                </div>

                {!showRender && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => clock.setPlaying(!clock.playing)}
                      aria-label={clock.playing ? "Pause preview" : "Play preview"}
                      className="grid h-10 w-10 place-items-center rounded-full bg-ink text-paper transition hover:bg-ink-2"
                    >
                      {clock.playing ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="ml-0.5 h-4 w-4" />}
                    </button>
                    <span className="font-mono text-[13px] tnum">
                      {formatTime(clock.t)} <span className="text-ink-3">/ 00:07.00</span>
                    </span>
                    <button
                      onClick={() => setMuted(!muted)}
                      aria-label={muted ? "Unmute preview" : "Mute preview"}
                      className="grid h-9 w-9 place-items-center rounded-full text-ink-2 transition hover:bg-paper-2"
                    >
                      {muted ? <MuteIcon className="h-4 w-4" /> : <VolumeIcon className="h-4 w-4" />}
                    </button>
                  </div>
                )}
              </div>

              <Timeline
                layers={project.layers}
                caption={captionDraft}
                layout={layout}
                editable={editable}
                onLayout={changeLayout}
                busyLabel={
                  rendering
                    ? (PHASE_STAGES.render.find((s) => stages[s.id]?.state === "active")?.label ?? "Rendering")
                    : null
                }
                t={clock.t}
                onSeek={(t) => {
                  if (showRender) setView("preview");
                  clock.seek(t);
                }}
              />

              <RenderPanel
                project={project}
                rendering={rendering}
                stages={phase === "render" ? stages : {}}
                error={
                  stuck
                    ? "The last render stopped responding. Render again to retry."
                    : phase === null && project.status !== "failed"
                      ? phaseError
                      : null
                }
                disabled={!canRender}
                onRender={() => run("render")}
              />
            </>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-4 lg:row-span-2 xl:order-3 xl:row-span-1" aria-label="Layers">
          <p className="font-mono text-[11px] tracking-[0.12em] text-ink-3 uppercase">Layers</p>
          {preparing && !prepared ? (
            [0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-40 rounded-2xl" />)
          ) : (
            <>
              <LayerCard
                kind="background"
                layer={project.layers.background}
                busy={busyLayer === "background"}
                disabled={!editable || (busyLayer !== null && busyLayer !== "background")}
                error={layerErrors.background}
                onSwap={(o) => onSwap("background", o)}
              />
              <CaptionCard
                caption={project.caption ?? ""}
                captionStyle={project.captionStyle}
                layout={layout.caption}
                onLayout={(part, commit) => changePart("caption", part, commit)}
                disabled={!editable}
                onDraft={setCaptionDraft}
                onSave={onSaveCaption}
                onStyle={onCaptionStyle}
              />
              <LayerCard
                kind="gif"
                layer={project.layers.gif}
                busy={busyLayer === "gif"}
                disabled={!editable || (busyLayer !== null && busyLayer !== "gif")}
                error={layerErrors.gif}
                onSwap={(o) => onSwap("gif", o)}
                enabled={layout.gif.enabled}
                onToggle={(enabled) => changePart("gif", { ...layout.gif, enabled }, true)}
              >
                <Slider
                  label="Size"
                  value={layout.gif.width}
                  min={LAYOUT_LIMITS.gifWidth[0]}
                  max={LAYOUT_LIMITS.gifWidth[1]}
                  step={10}
                  format={(v) => `${Math.round((v / 720) * 100)}%`}
                  disabled={!editable}
                  color="var(--l-gif)"
                  onChange={(width) => changePart("gif", { ...layoutRef.current.gif, width }, false)}
                  onCommit={() => changeLayout(layoutRef.current, true)}
                />
              </LayerCard>
              <LayerCard
                kind="audio"
                layer={project.layers.audio}
                busy={busyLayer === "audio"}
                disabled={!editable || (busyLayer !== null && busyLayer !== "audio")}
                error={layerErrors.audio}
                onSwap={(o) => onSwap("audio", o)}
                enabled={layout.audio.enabled}
                onToggle={(enabled) => changePart("audio", { ...layout.audio, enabled }, true)}
              >
                <Slider
                  label="Volume"
                  value={layout.audio.volume}
                  min={LAYOUT_LIMITS.volume[0]}
                  max={LAYOUT_LIMITS.volume[1]}
                  step={0.05}
                  format={(v) => `${Math.round(v * 100)}%`}
                  disabled={!editable}
                  color="var(--l-audio)"
                  onChange={(volume) => changePart("audio", { ...layoutRef.current.audio, volume }, false)}
                  onCommit={() => changeLayout(layoutRef.current, true)}
                />
              </LayerCard>
            </>
          )}
        </aside>

        <div className="min-w-0 xl:order-1">
          <BriefPanel project={project} loading={preparing} />
        </div>
      </div>
    </main>
  );
}

function StatusPill({ project, phase }: { project: ProjectDTO; phase: Phase | null }) {
  const status = phase === "prepare" ? "preparing" : phase === "render" ? "rendering" : project.status;
  const label: Record<string, string> = {
    draft: "Queued",
    preparing: "Preparing",
    ready: "Ready to render",
    rendering: "Rendering",
    rendered: project.stale ? "Edited since render" : "Rendered",
    failed: "Failed",
  };
  const live = status === "preparing" || status === "rendering" || status === "draft";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${
        status === "failed" ? "border-rec text-rec" : "border-line text-ink-2"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-rec" : status === "rendered" && !project.stale ? "bg-l-audio" : "bg-ink-3"}`}
      />
      {label[status]}
    </span>
  );
}

function StageList({ phase, stages }: { phase: Phase; stages: Partial<Record<Stage, StageState>> }) {
  return (
    <ol className="space-y-3">
      {PHASE_STAGES[phase].map(({ id, label }, i) => {
        const s = stages[id];
        return (
          <li key={id} className="grid grid-cols-[24px_1fr_auto] items-start gap-3">
            <span
              className={`mt-0.5 grid h-6 w-6 place-items-center rounded-full border text-[11px] ${
                s?.state === "done"
                  ? "border-ink bg-ink text-paper"
                  : s?.state === "active"
                    ? "border-rec text-rec"
                    : "border-line text-ink-3"
              }`}
            >
              {s?.state === "done" ? <CheckIcon className="h-3.5 w-3.5" /> : s?.state === "active" ? <Spinner className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className={`block text-[14px] ${s ? "text-ink" : "text-ink-3"}`}>{label}</span>
              {s?.message && <span className="block truncate text-[12px] text-ink-3">{s.message}</span>}
            </span>
            <span className="font-mono text-[12px] text-ink-3 tnum">
              {s?.ms !== undefined ? `${(s.ms / 1000).toFixed(1)}s` : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function PrepareView({
  stages,
  error,
  onRetry,
}: {
  stages: Partial<Record<Stage, StageState>>;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-md py-6 sm:py-12">
      <div className="rounded-2xl border border-line bg-card p-6">
        <p className="font-mono text-[11px] tracking-[0.12em] text-ink-3 uppercase">Preparing your cut</p>
        <p className="mt-2 font-serif text-[30px] leading-tight">
          Reading the page and choosing <em>one</em> idea.
        </p>
        <div className="mt-6">
          <StageList phase="prepare" stages={stages} />
        </div>
        {error && (
          <div role="alert" className="mt-6 flex items-start gap-3 rounded-xl bg-rec-soft p-3 text-[13px] text-ink">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-rec" />
            <span className="flex-1">{error}</span>
            <button onClick={onRetry} className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
              <RetryIcon className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RenderPanel({
  project,
  rendering,
  stages,
  error,
  disabled,
  onRender,
}: {
  project: ProjectDTO;
  rendering: boolean;
  stages: Partial<Record<Stage, StageState>>;
  error: string | null;
  disabled: boolean;
  onRender: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const hasVideo = !!project.videoUrl;

  if (!project.isOwner) return null;

  return (
    <section className="rounded-2xl border border-line bg-card p-4 sm:p-5">
      {rendering ? (
        <>
          <p className="mb-4 font-mono text-[11px] tracking-[0.12em] text-ink-3 uppercase">Rendering</p>
          <StageList phase="render" stages={stages} />
        </>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">
              {!hasVideo ? "Happy with the layers?" : project.stale ? "You've changed the layers" : "Your video is ready"}
            </p>
            <p className="mt-0.5 text-[13px] text-ink-3">
              {!hasVideo
                ? "Rendering cuts a 7s 720×1280 MP4 with exactly what the preview shows."
                : project.stale
                  ? "The render is out of date. Render again to include your edits."
                  : `Rendered in ${((project.renderMs ?? 0) / 1000).toFixed(1)}s · H.264 · 720×1280`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasVideo && !project.stale && (
              <>
                <a
                  href={project.videoUrl!}
                  download={`cutroom-${project.domain}.mp4`}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-[14px] font-medium transition hover:border-ink"
                >
                  <DownloadIcon className="h-4 w-4" /> MP4
                </a>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(`${window.location.origin}/v/${project.id}`).catch(() => {});
                    toast("Share link copied", "ok");
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-[14px] font-medium transition hover:border-ink"
                >
                  {copied ? <CheckIcon className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                  {copied ? "Copied" : "Share link"}
                </button>
                <Link
                  href={`/v/${project.id}`}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-[14px] font-medium transition hover:border-ink"
                >
                  <ExternalIcon className="h-4 w-4" /> Page
                </Link>
              </>
            )}
            <button
              onClick={onRender}
              disabled={disabled}
              className={`inline-flex h-10 items-center gap-1.5 rounded-full px-5 text-[14px] font-medium transition active:scale-[0.98] disabled:opacity-40 ${
                hasVideo && !project.stale ? "border border-line hover:border-ink" : "bg-rec text-white hover:brightness-105"
              }`}
            >
              {hasVideo ? <RetryIcon className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-white" />}
              {hasVideo ? (project.stale ? "Render again" : "Re-render") : "Render video"}
            </button>
          </div>
        </div>
      )}
      {(error || project.error) && !rendering && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-[13px] text-rec">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="line-clamp-3">{error || project.error}</span>
        </p>
      )}
    </section>
  );
}
