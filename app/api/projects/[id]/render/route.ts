import { getOwnerId } from "@/lib/owner";
import { renderProject } from "@/lib/pipeline";
import { handleError, jsonError, streamPipeline, uuidSchema } from "@/lib/http";

// ffmpeg needs a real Node.js process, not the Edge runtime.
export const runtime = "nodejs";
export const maxDuration = 60;

/** POST /api/projects/:id/render — download → ffmpeg → store, streamed as NDJSON. */
export async function POST(_req: Request, ctx: RouteContext<"/api/projects/[id]/render">) {
  try {
    const id = uuidSchema.parse((await ctx.params).id);
    const ownerId = await getOwnerId();
    if (!ownerId) return jsonError("Not your project", 403);
    return streamPipeline(id, ownerId, (emit) => renderProject(id, ownerId, emit));
  } catch (err) {
    return handleError(err);
  }
}
