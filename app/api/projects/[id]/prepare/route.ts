import { getOwnerId } from "@/lib/owner";
import { prepareProject } from "@/lib/pipeline";
import { handleError, jsonError, streamPipeline, uuidSchema } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST /api/projects/:id/prepare — scrape → plan → source, streamed as NDJSON. */
export async function POST(_req: Request, ctx: RouteContext<"/api/projects/[id]/prepare">) {
  try {
    const id = uuidSchema.parse((await ctx.params).id);
    const ownerId = await getOwnerId();
    if (!ownerId) return jsonError("Not your project", 403);
    return streamPipeline(id, ownerId, (emit) => prepareProject(id, ownerId, emit));
  } catch (err) {
    return handleError(err);
  }
}
