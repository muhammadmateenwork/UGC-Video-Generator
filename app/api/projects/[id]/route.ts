import { z } from "zod";
import { getOwnerId } from "@/lib/owner";
import { deleteProject, loadProject, updateCaption } from "@/lib/pipeline";
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

const patchBody = z.object({
  caption: z.string().trim().min(1, "Caption can't be empty").max(60, "Keep the caption under 60 characters"),
});

/** PATCH /api/projects/:id { caption } */
export async function PATCH(req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    const id = uuidSchema.parse((await ctx.params).id);
    const ownerId = await getOwnerId();
    if (!ownerId) return jsonError("Not your project", 403);
    const { caption } = patchBody.parse(await req.json().catch(() => ({})));
    await updateCaption(id, ownerId, caption);
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
