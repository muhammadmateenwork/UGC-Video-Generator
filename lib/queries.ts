import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db, events, layers, projects } from "./db";
import { isCaptionStyle, normalizeLayout, type CaptionStyle, type Layout } from "./composition";
import type { ProjectSummaryDTO } from "./dto";

function summaryQuery() {
  return db()
    .select({ p: projects, thumbUrl: layers.thumbUrl })
    .from(projects)
    .leftJoin(layers, and(eq(layers.projectId, projects.id), eq(layers.kind, "background")));
}

function toSummary({ p, thumbUrl }: { p: typeof projects.$inferSelect; thumbUrl: string | null }): ProjectSummaryDTO {
  return {
    id: p.id,
    domain: p.domain,
    title: p.title,
    status: p.status,
    caption: p.caption,
    videoUrl: p.videoUrl,
    thumbUrl,
    createdAt: p.createdAt.toISOString(),
  };
}

/** The viewer's own library, newest first. */
export async function listOwnerProjects(ownerId: string, limit = 100): Promise<ProjectSummaryDTO[]> {
  const rows = await summaryQuery()
    .where(eq(projects.ownerId, ownerId))
    .orderBy(desc(projects.createdAt))
    .limit(limit);
  return rows.map(toSummary);
}

/** Everyone's finished videos — the public wall on the start screen. */
export async function listRecentRendered(limit = 12): Promise<ProjectSummaryDTO[]> {
  const rows = await summaryQuery()
    .where(and(eq(projects.status, "rendered"), isNotNull(projects.videoUrl)))
    .orderBy(desc(projects.renderedAt))
    .limit(limit);
  return rows.map(toSummary);
}

export interface Showcase {
  domain: string;
  caption: string;
  captionStyle: CaptionStyle;
  layout: Layout;
  backgroundThumb: string | null;
  gifUrl: string | null;
}

/**
 * The latest finished video, broken into its real layers — the home page
 * draws it as an exploded view, so the hero shows an actual cut from the
 * database rather than an illustration of one.
 */
export async function loadShowcase(): Promise<Showcase | null> {
  const [p] = await db()
    .select()
    .from(projects)
    .where(and(eq(projects.status, "rendered"), isNotNull(projects.videoUrl)))
    .orderBy(desc(projects.renderedAt))
    .limit(1);
  if (!p) return null;
  const ls = await db().select().from(layers).where(eq(layers.projectId, p.id));
  const byKind = Object.fromEntries(ls.map((l) => [l.kind, l]));
  return {
    domain: p.domain,
    caption: p.caption ?? "",
    captionStyle: isCaptionStyle(p.captionStyle) ? p.captionStyle : "box",
    layout: normalizeLayout(p.layout),
    backgroundThumb: byKind.background?.thumbUrl ?? null,
    gifUrl: byKind.gif?.previewUrl ?? null,
  };
}

export type StageTiming = { stage: string; medianMs: number; runs: number };

/**
 * Median real duration of each pipeline stage across every run, straight
 * from the activity log — the numbers on the home page are measured, not
 * marketing copy.
 */
export async function loadStageTimings(): Promise<Record<string, StageTiming>> {
  const rows = await db()
    .select({
      stage: events.stage,
      medianMs: sql<number>`percentile_cont(0.5) within group (order by ${events.durationMs})::int`,
      runs: sql<number>`count(*)::int`,
    })
    .from(events)
    .where(and(isNotNull(events.durationMs), eq(events.level, "info"), inArray(events.stage, ["scrape", "plan", "source", "download", "render", "upload"])))
    .groupBy(events.stage);
  return Object.fromEntries(rows.map((r) => [r.stage, r]));
}
