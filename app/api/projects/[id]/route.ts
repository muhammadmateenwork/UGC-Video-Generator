import { z } from "zod";
import { CAPTION_STYLES } from "@/lib/composition";
import { getOwnerId } from "@/lib/owner";
import { deleteProject, loadProject, updateProject } from "@/lib/pipeline";
import { handleError, jsonError, uuidSchema } from "@/lib/http";

/** GET /api/projects/:id — full project with layers and activity log. */
export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    const id = uuidSchema.parse((await ctx.params).id);
    const project = await loadProject(id, await getOwnerId());
    if (!project) return jsonError("Project not found", 404);
    return Response.json({ project });
  } catch (err) {
    return handleError(err);
  }
}

const patchBody = z
  .object({
    caption: z.string().trim().min(1, "Caption can't be empty").max(60, "Keep the caption under 60 characters").optional(),
    captionStyle: z.enum(CAPTION_STYLES).optional(),
    /** Normalised (clamped, defaults filled) server-side by normalizeLayout — any partial shape is accepted. */
    layout: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((b) => b.caption !== undefined || b.captionStyle !== undefined || b.layout !== undefined, "Nothing to update");

/** PATCH /api/projects/:id { caption?, captionStyle?, layout? } */
export async function PATCH(req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    const id = uuidSchema.parse((await ctx.params).id);
    const ownerId = await getOwnerId();
    if (!ownerId) return jsonError("Not your project", 403);
    await updateProject(id, ownerId, patchBody.parse(await req.json().catch(() => ({}))));
    return Response.json({ project: await loadProject(id, ownerId) });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/projects/:id */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    const id = uuidSchema.parse((await ctx.params).id);
    const ownerId = await getOwnerId();
    if (!ownerId || !(await deleteProject(id, ownerId))) return jsonError("Project not found", 404);
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
