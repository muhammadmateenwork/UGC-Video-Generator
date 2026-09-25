import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db, layers, projects } from "./db";
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
