import { z } from "zod";
import { getOwnerId } from "@/lib/owner";
import { LAYER_KINDS, loadProject, shuffleLayer } from "@/lib/pipeline";
import { handleError, jsonError, uuidSchema } from "@/lib/http";

const body = z.object({
  /** A new search term. Omit to step through the current search's results. */
  query: z.string().trim().max(60).optional(),
  step: z.union([z.literal(1), z.literal(-1)]).optional(),
});

/** POST /api/projects/:id/layers/:kind { query?, step? } — swap one layer's asset. */
export async function POST(req: Request, ctx: RouteContext<"/api/projects/[id]/layers/[kind]">) {
  try {
    const params = await ctx.params;
    const id = uuidSchema.parse(params.id);
    const kind = z.enum(LAYER_KINDS as ["background", "gif", "audio"]).parse(params.kind);
    const ownerId = await getOwnerId();
    if (!ownerId) return jsonError("Not your project", 403);
    const opts = body.parse(await req.json().catch(() => ({})));
    await shuffleLayer(id, ownerId, kind, opts);
    return Response.json({ project: await loadProject(id, ownerId) });
  } catch (err) {
    return handleError(err);
  }
}
