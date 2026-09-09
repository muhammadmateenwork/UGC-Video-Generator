export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  videoUrl?: string;
  /** Set while the assistant is still working on this message (status text, streaming tokens). */
  pending?: boolean;
  /** Progress label shown before any reply text has streamed in (e.g. "Rendering your video..."). */
  status?: string;
  /** Which pipeline phase `status` refers to, for the stepper UI. Unset for plain chat replies. */
  stage?: PipelineStage;
}

export type PipelineStage = "scrape" | "plan" | "source" | "render" | "upload";

/** Server-sent event payloads for POST /api/chat. */
export type ChatStreamEvent =
  | { type: "status"; text: string; stage?: PipelineStage }
  | { type: "token"; text: string }
  | { type: "video"; url: string }
  | { type: "error"; text: string }
  | { type: "done" };
