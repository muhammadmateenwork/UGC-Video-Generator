import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db, events, layers, projects, type LayerKind, type Project } from "./db";
import { scrapeProduct } from "./scrape";
import { planCreative, GeminiUnavailableError, type CreativePlan } from "./gemini";
import { AUDIO_MAX_BYTES, fetchBuffer, sourceLayer, type LayerCandidate } from "./assets";
import { assembleUgcClip } from "./assemble";
import { storeVideo } from "./storage";
import { STALE_LOCK_MS, toProjectDTO, type ProjectDTO } from "./dto";
import {
  CAPTION_STYLE_META,
  isCaptionStyle,
  normalizeLayout,
  type CaptionStyle,
  type Layout,
} from "./composition";

/** A one-line, human summary of a layout for the activity log. */
function describeLayout(l: Layout) {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const secs = (v: number) => `${(v * 7).toFixed(1)}s`;
  const parts = [
    l.caption.enabled
      ? `caption at ${pct(l.caption.x)},${pct(l.caption.y)} ×${l.caption.scale.toFixed(2)} ${secs(l.caption.start)}–${secs(l.caption.end)}`
      : "caption off",
    l.gif.enabled
      ? `GIF ${l.gif.width}px at ${pct(l.gif.x)},${pct(l.gif.y)} ${secs(l.gif.start)}–${secs(l.gif.end)}`
      : "GIF off",
    l.audio.enabled ? `audio ${pct(l.audio.volume)}` : "audio off",
  ];
  return `layout: ${parts.join(" · ")}`;
}

export const LAYER_KINDS: LayerKind[] = ["background", "gif", "audio"];


export type Stage = "scrape" | "plan" | "source" | "download" | "render" | "upload";

export type PipelineEvent =
  | { type: "stage"; stage: Stage; state: "start" }
  | { type: "stage"; stage: Stage; state: "done"; ms: number; message: string }
  | { type: "project"; project: ProjectDTO }
  | { type: "error"; message: string };

type Emit = (e: PipelineEvent) => void;

export class PipelineError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

async function logEvent(projectId: string, stage: string, message: string, durationMs?: number, level = "info") {
  await db().insert(events).values({ projectId, stage, message, durationMs, level });
}

/** Runs one stage, emitting start/done to the live stream and persisting the outcome with its real duration. */
async function stage<T>(
  projectId: string,
  name: Stage,
  emit: Emit,
  fn: () => Promise<{ value: T; message: string }>
): Promise<T> {
  emit({ type: "stage", stage: name, state: "start" });
  const started = Date.now();
  const { value, message } = await fn();
  const ms = Date.now() - started;
  await logEvent(projectId, name, message, ms);
  emit({ type: "stage", stage: name, state: "done", ms, message });
  return value;
}

export async function loadProject(id: string, viewerId: string | null): Promise<ProjectDTO | null> {
  const [p] = await db().select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!p) return null;
  const [ls, es] = await Promise.all([
    db().select().from(layers).where(eq(layers.projectId, id)),
    db().select().from(events).where(eq(events.projectId, id)).orderBy(asc(events.createdAt)),
  ]);
  return toProjectDTO(p, ls, es, viewerId);
}

/**
 * Atomically moves a project into a busy state, only from states where that
 * is legal. Doing the check inside the UPDATE (not read-then-write) is what
 * stops two tabs, or a double-click, from starting the same render twice.
 */
async function acquire(
  id: string,
  ownerId: string,
  to: "preparing" | "rendering",
  from: Project["status"][]
): Promise<Project> {
  const [row] = await db()
    .update(projects)
    .set({ status: to, error: null })
    .where(
      and(
        eq(projects.id, id),
        eq(projects.ownerId, ownerId),
        or(
          inArray(projects.status, from),
          // Takeover of a dead lock, timed on the database's clock so app-server skew can't matter.
          and(eq(projects.status, to), lt(projects.updatedAt, sql`now() - make_interval(secs => ${STALE_LOCK_MS / 1000})`))
        )
      )
    )
    .returning();
  if (row) return row;

  const [existing] = await db().select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!existing) throw new PipelineError("Project not found", 404);
  if (existing.ownerId !== ownerId) throw new PipelineError("You can only edit your own projects", 403);
  throw new PipelineError(
    existing.status === to ? `Already ${to} — hang tight` : `Can't start ${to} while ${existing.status}`,
    409
  );
}

function candidateRow(projectId: string, kind: LayerKind, query: string, index: number, total: number, c: LayerCandidate) {
  return {
    projectId,
    kind,
    query,
    candidateIndex: index,
    provider: c.provider,
    mediaType: c.mediaType,
    previewUrl: c.previewUrl,
    renderUrl: c.renderUrl,
    thumbUrl: c.thumbUrl,
    title: c.title,
    creditName: c.creditName,
    creditUrl: c.creditUrl,
    meta: { ...c.meta, total },
  };
}

async function upsertLayer(row: ReturnType<typeof candidateRow>) {
  await db()
    .insert(layers)
    .values(row)
    .onConflictDoUpdate({
      target: [layers.projectId, layers.kind],
      set: { ...row, updatedAt: sql`now()` },
    });
}

/** Deterministic plan used only if Gemini is genuinely unavailable — keeps
 * the pipeline able to produce something coherent rather than failing. */
function fallbackPlan(title: string, domain: string): CreativePlan {
  const name = (title || domain).split(/[|\-–—:]/)[0].trim().slice(0, 28);
  return {
    angle: "",
    caption: `you need ${name.toLowerCase()}`,
    backgroundQuery: "modern lifestyle",
    gifQuery: "mind blown",
    audioQuery: "upbeat",
  };
}

const MAX_PROJECTS_PER_HOUR = 15;

export async function createProject(ownerId: string, url: string, domain: string): Promise<string> {
  const [{ count }] = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(projects)
    .where(and(eq(projects.ownerId, ownerId), sql`${projects.createdAt} > now() - interval '1 hour'`));
  if (count >= MAX_PROJECTS_PER_HOUR) {
    throw new PipelineError("You've started a lot of videos this hour — try again in a bit", 429);
  }
  const [row] = await db().insert(projects).values({ ownerId, url, domain }).returning({ id: projects.id });
  await logEvent(row.id, "create", `Project created for ${domain}`);
  return row.id;
}

/** scrape → plan → source. Leaves the project `ready` with a selected candidate for every layer that had results. */
export async function prepareProject(id: string, ownerId: string, emit: Emit): Promise<void> {
  const project = await acquire(id, ownerId, "preparing", ["draft", "failed"]);
  try {
    const scraped = await stage(id, "scrape", emit, async () => {
      const s = await scrapeProduct(project.url);
      await db()
        .update(projects)
        .set({ title: s.title, description: s.description || null, imageUrl: s.imageUrl })
        .where(eq(projects.id, id));
      return {
        value: s,
        message: s.bodyText ? `Read "${s.title}" (${s.bodyText.length} chars of copy)` : `Page unreadable — using the domain only`,
      };
    });

    const plan = await stage(id, "plan", emit, async () => {
      let source = "gemini";
      let p: CreativePlan;
      try {
        p = await planCreative(scraped);
      } catch (err) {
        if (!(err instanceof GeminiUnavailableError)) throw err;
        source = "fallback";
        p = fallbackPlan(scraped.title, scraped.domain);
      }
      await db()
        .update(projects)
        .set({ caption: p.caption, angle: p.angle || null, planSource: source })
        .where(eq(projects.id, id));
      return {
        value: p,
        message: source === "gemini" ? `Planned: "${p.caption}"` : `AI unavailable — used the fallback plan`,
      };
    });

    await stage(id, "source", emit, async () => {
      const queries: Record<LayerKind, string> = {
        background: plan.backgroundQuery,
        gif: plan.gifQuery,
        audio: plan.audioQuery,
      };
      const results = await Promise.all(
        LAYER_KINDS.map(async (kind) => {
          const r = await sourceLayer(kind, queries[kind]).catch(() => null);
          if (r) await upsertLayer(candidateRow(id, kind, queries[kind], r.index, r.total, r.candidate));
          return [kind, r?.total ?? 0] as const;
        })
      );
      return { value: null, message: results.map(([k, n]) => `${k} ${n}`).join(" · ") + " candidates" };
    });

    await db().update(projects).set({ status: "ready" }).where(eq(projects.id, id));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db().update(projects).set({ status: "failed", error: message }).where(eq(projects.id, id));
    await logEvent(id, "prepare", message, undefined, "error");
    throw err;
  }
}

/** Swap one layer: next/previous result of the same search, or a brand-new search query. */
export async function shuffleLayer(
  id: string,
  ownerId: string,
  kind: LayerKind,
  opts: { query?: string; step?: number }
): Promise<void> {
  const [p] = await db().select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!p) throw new PipelineError("Project not found", 404);
  if (p.ownerId !== ownerId) throw new PipelineError("You can only edit your own projects", 403);
  if (p.status === "rendering" || p.status === "preparing") throw new PipelineError(`Busy ${p.status}`, 409);

  const [current] = await db()
    .select()
    .from(layers)
    .where(and(eq(layers.projectId, id), eq(layers.kind, kind)))
    .limit(1);
  const newQuery = opts.query?.trim();
  const query = newQuery || current?.query;
  if (!query) throw new PipelineError("Nothing to search for — enter a search term", 400);
  const index = newQuery && newQuery !== current?.query ? 0 : (current?.candidateIndex ?? 0) + (opts.step ?? 1);

  const started = Date.now();
  const r = await sourceLayer(kind, query, index);
  if (!r) throw new PipelineError(`No ${kind} results for "${query}" — try another search`, 404);
  await upsertLayer(candidateRow(id, kind, query, r.index, r.total, r.candidate));
  await logEvent(
    id,
    "edit",
    newQuery ? `${kind}: searched "${query}"` : `${kind}: switched to option ${r.index + 1} of ${r.total}`,
    Date.now() - started
  );
}

export async function updateProject(
  id: string,
  ownerId: string,
  patch: { caption?: string; captionStyle?: CaptionStyle; layout?: unknown }
): Promise<void> {
  const layout = patch.layout === undefined ? undefined : normalizeLayout(patch.layout);
  const [row] = await db()
    .update(projects)
    .set({ ...patch, layout: layout as Record<string, unknown> | undefined })
    .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
    .returning({ id: projects.id });
  if (!row) throw new PipelineError("Project not found", 404);
  if (patch.caption !== undefined) await logEvent(id, "edit", `caption: "${patch.caption}"`);
  if (patch.captionStyle) await logEvent(id, "edit", `caption style: ${CAPTION_STYLE_META[patch.captionStyle].label}`);
  if (layout) await logEvent(id, "edit", describeLayout(layout));
}

/** download → render → upload. Always leaves the project re-renderable. */
export async function renderProject(id: string, ownerId: string, emit: Emit): Promise<void> {
  const project = await acquire(id, ownerId, "rendering", ["ready", "rendered", "failed"]);
  const started = Date.now();
  try {
    const layout = normalizeLayout(project.layout);
    const selected = await db().select().from(layers).where(eq(layers.projectId, id));
    // A layer switched off in the studio is neither downloaded nor rendered.
    const enabled = { background: true, gif: layout.gif.enabled, audio: layout.audio.enabled };
    const byKind = Object.fromEntries(selected.filter((l) => enabled[l.kind]).map((l) => [l.kind, l]));

    const media = await stage(id, "download", emit, async () => {
      const [bg, gif, audio] = await Promise.all(
        LAYER_KINDS.map((k) =>
          byKind[k]
            ? fetchBuffer(byKind[k].renderUrl, { maxBytes: k === "audio" ? AUDIO_MAX_BYTES : undefined })
            : Promise.resolve(null)
        )
      );
      // A layer with nothing selected renders with its fallback; a layer the
      // user DID choose that fails to download is an error, not a silent
      // substitution — otherwise a flaky connection produces a blank video
      // that looks like success (observed on a slow link before this check).
      // Audio is the one soft exception: Freesound's CDN is the slow one, and
      // a clip without music is still the clip the user asked for.
      const missing = (["background", "gif"] as const).filter((k) => byKind[k] && !(k === "background" ? bg : gif));
      if (missing.length > 0) {
        throw new PipelineError(
          `Couldn't download the ${missing.join(" and ")} from ${missing.map((k) => byKind[k].provider).join(" / ")} — check the connection and render again`,
          502
        );
      }
      if (byKind.audio && !audio) {
        await logEvent(id, "download", "Audio download timed out — rendering without music", undefined, "warn");
      }
      const got = [bg && "background", gif && "GIF", audio && "audio"].filter(Boolean);
      const mb = [bg, gif, audio].reduce((n, b) => n + (b?.length ?? 0), 0) / 1e6;
      return {
        value: { bg, gif, audio },
        message: got.length ? `Fetched ${got.join(", ")} (${mb.toFixed(1)} MB)` : "No layers selected — rendering the fallback canvas",
      };
    });

    const clip = await stage(id, "render", emit, async () => {
      const bgLayer = byKind.background;
      const buffer = await assembleUgcClip({
        background:
          media.bg && bgLayer ? { type: bgLayer.mediaType === "video" ? "video" : "image", buffer: media.bg } : null,
        gifBuffer: media.gif,
        audioBuffer: media.audio,
        caption: layout.caption.enabled ? (project.caption ?? "") : "",
        captionStyle: isCaptionStyle(project.captionStyle) ? project.captionStyle : "box",
        layout,
      });
      return { value: buffer, message: `Encoded 7s 720×1280 H.264 (${(buffer.length / 1e6).toFixed(1)} MB)` };
    });

    const videoUrl = await stage(id, "upload", emit, async () => {
      const url = await storeVideo(clip);
      return { value: url, message: process.env.VERCEL ? "Stored on Vercel Blob" : "Stored locally" };
    });

    await db()
      .update(projects)
      .set({ status: "rendered", videoUrl, renderMs: Date.now() - started, renderedAt: sql`now()` })
      .where(eq(projects.id, id));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Back to a renderable state; keep any previous video rather than wiping it.
    await db()
      .update(projects)
      .set({ status: project.videoUrl ? "rendered" : "ready", error: message.slice(0, 500) })
      .where(eq(projects.id, id));
    await logEvent(id, "render", message.slice(0, 500), undefined, "error");
    throw err;
  }
}

export async function deleteProject(id: string, ownerId: string): Promise<boolean> {
  const rows = await db()
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
    .returning({ id: projects.id });
  return rows.length > 0;
}
