import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * A project moves through two server-side phases the user can see and
 * control separately:
 *   draft → preparing → ready       (scrape, plan, source layer candidates)
 *   ready → rendering → rendered    (download assets, ffmpeg, store mp4)
 * Either phase can land in `failed`; a failed render drops back to a
 * re-renderable state rather than losing the prepared layers.
 */
export const projectStatus = pgEnum("project_status", [
  "draft",
  "preparing",
  "ready",
  "rendering",
  "rendered",
  "failed",
]);

export const layerKind = pgEnum("layer_kind", ["background", "gif", "audio"]);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Anonymous per-browser owner id (httpOnly cookie) — scopes the library without forcing sign-up. */
    ownerId: text("owner_id").notNull(),
    url: text("url").notNull(),
    domain: text("domain").notNull(),
    title: text("title"),
    description: text("description"),
    imageUrl: text("image_url"),
    status: projectStatus("status").notNull().default("draft"),
    caption: text("caption"),
    /** One of CAPTION_STYLES in lib/composition.ts — read by both the preview and the renderer. */
    captionStyle: text("caption_style").notNull().default("box"),
    /** The one-line creative idea the AI planned around, shown so the plan is legible, not a black box. */
    angle: text("angle"),
    /** "gemini" or "fallback" — surfaced in the UI instead of silently degrading. */
    planSource: text("plan_source"),
    videoUrl: text("video_url"),
    renderMs: integer("render_ms"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
    renderedAt: timestamp("rendered_at", { withTimezone: true }),
  },
  (t) => [
    index("projects_owner_created_idx").on(t.ownerId, t.createdAt),
    index("projects_status_rendered_idx").on(t.status, t.renderedAt),
  ]
);

/**
 * The currently selected asset for one layer of a project. `query` is what
 * was searched and `candidateIndex` is which result of that search is in
 * use — "shuffle" just advances the index, "new search" replaces the query.
 */
export const layers = pgTable(
  "layers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: layerKind("kind").notNull(),
    query: text("query").notNull(),
    candidateIndex: integer("candidate_index").notNull().default(0),
    provider: text("provider").notNull(),
    /** "video" | "image" | "gif" | "audio" */
    mediaType: text("media_type").notNull(),
    /** Lightweight asset for the in-browser preview. */
    previewUrl: text("preview_url").notNull(),
    /** Higher-quality asset downloaded at render time. */
    renderUrl: text("render_url").notNull(),
    thumbUrl: text("thumb_url"),
    title: text("title"),
    creditName: text("credit_name"),
    creditUrl: text("credit_url"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (t) => [uniqueIndex("layers_project_kind_uq").on(t.projectId, t.kind)]
);

/** Append-only activity log — every pipeline stage with its real duration. */
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    stage: text("stage").notNull(),
    level: text("level").notNull().default("info"),
    message: text("message").notNull(),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_project_created_idx").on(t.projectId, t.createdAt)]
);

export type Project = typeof projects.$inferSelect;
export type Layer = typeof layers.$inferSelect;
export type LayerKind = (typeof layerKind.enumValues)[number];
export type ProjectStatus = (typeof projectStatus.enumValues)[number];
export type ProjectEvent = typeof events.$inferSelect;
