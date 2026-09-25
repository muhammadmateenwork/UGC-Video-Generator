import { z } from "zod";
import { ensureOwnerId, getOwnerId } from "@/lib/owner";
import { createProject } from "@/lib/pipeline";
import { listOwnerProjects } from "@/lib/queries";
import { handleError, productUrlSchema } from "@/lib/http";

/** GET /api/projects — the caller's library, newest first. */
export async function GET() {
  try {
    const ownerId = await getOwnerId();
    return Response.json({ projects: ownerId ? await listOwnerProjects(ownerId) : [] });
  } catch (err) {
    return handleError(err);
  }
}

const createBody = z.object({ url: productUrlSchema });

/** POST /api/projects { url } — creates a draft; the client then streams /prepare. */
export async function POST(req: Request) {
  try {
    const { url } = createBody.parse(await req.json().catch(() => ({})));
    const ownerId = await ensureOwnerId();
    const id = await createProject(ownerId, url.url, url.domain);
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
