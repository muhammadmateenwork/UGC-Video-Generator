import type { ProjectDTO } from "./dto";
import type { LayerKind } from "./db/schema";
import type { CaptionStyle, Layout } from "./composition";
import type { PipelineEvent } from "./pipeline";

/** Browser-side API client — thin, typed wrappers over the REST endpoints. */

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body?.error) return body.error;
  } catch {}
  return `Request failed (${res.status})`;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<T>;
}

export async function createProject(url: string): Promise<string> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return (await json<{ id: string }>(res)).id;
}

export async function patchProject(
  id: string,
  patch: { caption?: string; captionStyle?: CaptionStyle; layout?: Layout }
): Promise<ProjectDTO> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return (await json<{ project: ProjectDTO }>(res)).project;
}

export async function swapLayer(
  id: string,
  kind: LayerKind,
  opts: { query?: string; step?: 1 | -1 }
): Promise<ProjectDTO> {
  const res = await fetch(`/api/projects/${id}/layers/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  return (await json<{ project: ProjectDTO }>(res)).project;
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(await readError(res));
}

/** POSTs to a streaming pipeline endpoint and calls `onEvent` for each NDJSON line as it arrives. */
export async function runPipeline(
  id: string,
  phase: "prepare" | "render",
  onEvent: (e: PipelineEvent) => void
): Promise<void> {
  const res = await fetch(`/api/projects/${id}/${phase}`, { method: "POST" });
  if (!res.ok || !res.body) throw new Error(await readError(res));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        onEvent(JSON.parse(line) as PipelineEvent);
      } catch {
        // ignore a malformed line rather than killing the stream
      }
    }
  }
}
