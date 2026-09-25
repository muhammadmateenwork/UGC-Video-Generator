import { z } from "zod";
import { PipelineError, loadProject, type PipelineEvent } from "./pipeline";
import { extractUrl } from "./intent";
import { normalizeUrl } from "./scrape";

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/** Maps known pipeline errors to their HTTP status; anything else is a 500 with a safe message. */
export function handleError(err: unknown) {
  if (err instanceof PipelineError) return jsonError(err.message, err.status);
  if (err instanceof z.ZodError) return jsonError(err.issues[0]?.message ?? "Invalid request", 400);
  console.error(err);
  const msg = err instanceof Error && err.message.includes("DATABASE_URL") ? err.message : "Something went wrong";
  return jsonError(msg, 500);
}

/**
 * Streams pipeline progress as newline-delimited JSON — one event per line,
 * ending with the fresh project (or an error). NDJSON over a plain POST
 * keeps the client a simple `fetch` + line reader, and each stage's real
 * timing reaches the UI the moment it finishes.
 *
 * Progress is best-effort, the work is not: if the browser goes away
 * mid-render (tab closed, navigation), writes are dropped silently and the
 * pipeline still finishes and saves. Found by testing — a disconnect used to
 * throw "Controller is already closed" out of the upload stage and mark a
 * render that had actually succeeded as failed.
 */
export function streamPipeline(
  projectId: string,
  ownerId: string,
  run: (emit: (e: PipelineEvent) => void) => Promise<void>
): Response {
  const encoder = new TextEncoder();
  let open = true;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: PipelineEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          open = false;
        }
      };
      try {
        await run(emit);
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : "Something went wrong" });
      }
      try {
        if (open) {
          const project = await loadProject(projectId, ownerId);
          if (project) emit({ type: "project", project });
        }
      } finally {
        if (open) {
          open = false;
          try {
            controller.close();
          } catch {}
        }
      }
    },
    cancel() {
      open = false;
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

const PRIVATE_HOST =
  /^(localhost|.*\.local|.*\.internal|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|0\.0\.0\.0|\[?::1?\]?)$/i;

/**
 * Accepts a full URL, a bare domain, or a sentence containing one
 * ("I'm building CalAI — calai.app"), and returns a normalized public
 * http(s) URL. Private/loopback hosts are refused: the server fetches this
 * URL, so it must not become a way to probe the server's own network.
 */
export const productUrlSchema = z
  .string()
  .trim()
  .min(1, "Paste a product link")
  .max(2000)
  .transform((raw, ctx) => {
    const found = extractUrl(raw);
    if (!found) {
      ctx.addIssue({ code: "custom", message: "That doesn't look like a link — try something like allbirds.com" });
      return z.NEVER;
    }
    try {
      const url = new URL(normalizeUrl(found));
      if (!/^https?:$/.test(url.protocol) || PRIVATE_HOST.test(url.hostname)) throw new Error();
      return { url: url.toString(), domain: url.hostname.replace(/^www\./, "") };
    } catch {
      ctx.addIssue({ code: "custom", message: "That link can't be used — try a public website" });
      return z.NEVER;
    }
  });

export const uuidSchema = z.uuid("Invalid project id");
