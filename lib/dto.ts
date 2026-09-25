import type { Layer, LayerKind, Project, ProjectEvent, ProjectStatus } from "./db/schema";
import { isCaptionStyle, type CaptionStyle } from "./composition";

/** A busy phase (preparing/rendering) whose row hasn't changed in this long is presumed dead and may be retried. */
export const STALE_LOCK_MS = 90_000;

/** JSON shapes shared by the API and the client — dates as ISO strings, no owner ids. */
export interface LayerDTO {
  kind: LayerKind;
  query: string;
  candidateIndex: number;
  total: number | null;
  provider: string;
  mediaType: "video" | "image" | "gif" | "audio";
  previewUrl: string;
  thumbUrl: string | null;
  title: string | null;
  creditName: string | null;
  creditUrl: string | null;
  meta: Record<string, unknown>;
}

export interface EventDTO {
  id: string;
  stage: string;
  level: string;
  message: string;
  durationMs: number | null;
  createdAt: string;
}

export interface ProjectDTO {
  id: string;
  url: string;
  domain: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  status: ProjectStatus;
  caption: string | null;
  captionStyle: CaptionStyle;
  angle: string | null;
  planSource: string | null;
  videoUrl: string | null;
  renderMs: number | null;
  error: string | null;
  createdAt: string;
  /** How long since the project row last changed, measured on the server — no browser-clock skew. */
  idleMs: number;
  renderedAt: string | null;
  isOwner: boolean;
  /** True once the layers changed after the last render — the video on screen is out of date. */
  stale: boolean;
  layers: Partial<Record<LayerKind, LayerDTO>>;
  events: EventDTO[];
}

export interface ProjectSummaryDTO {
  id: string;
  domain: string;
  title: string | null;
  status: ProjectStatus;
  caption: string | null;
  videoUrl: string | null;
  thumbUrl: string | null;
  createdAt: string;
}

export function toLayerDTO(l: Layer): LayerDTO {
  const meta = (l.meta ?? {}) as Record<string, unknown>;
  return {
    kind: l.kind,
    query: l.query,
    candidateIndex: l.candidateIndex,
    total: typeof meta.total === "number" ? meta.total : null,
    provider: l.provider,
    mediaType: l.mediaType as LayerDTO["mediaType"],
    previewUrl: l.previewUrl,
    thumbUrl: l.thumbUrl,
    title: l.title,
    creditName: l.creditName,
    creditUrl: l.creditUrl,
    meta,
  };
}

export function toProjectDTO(
  p: Project,
  layers: Layer[],
  events: ProjectEvent[],
  viewerId: string | null
): ProjectDTO {
  const byKind: ProjectDTO["layers"] = {};
  for (const l of layers) byKind[l.kind] = toLayerDTO(l);
  const lastEdit = Math.max(p.updatedAt.getTime(), ...layers.map((l) => l.updatedAt.getTime()));
  return {
    id: p.id,
    url: p.url,
    domain: p.domain,
    title: p.title,
    description: p.description,
    imageUrl: p.imageUrl,
    status: p.status,
    caption: p.caption,
    captionStyle: isCaptionStyle(p.captionStyle) ? p.captionStyle : "box",
    angle: p.angle,
    planSource: p.planSource,
    videoUrl: p.videoUrl,
    renderMs: p.renderMs,
    error: p.error,
    createdAt: p.createdAt.toISOString(),
    idleMs: Math.max(0, Date.now() - p.updatedAt.getTime()),
    renderedAt: p.renderedAt?.toISOString() ?? null,
    isOwner: viewerId !== null && viewerId === p.ownerId,
    // A small grace window: the render itself bumps updatedAt when it saves.
    stale: !!p.videoUrl && !!p.renderedAt && lastEdit - p.renderedAt.getTime() > 1500,
    layers: byKind,
    events: events.map((e) => ({
      id: e.id,
      stage: e.stage,
      level: e.level,
      message: e.message,
      durationMs: e.durationMs,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}
