export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  videoUrl?: string;
  /** Set while the assistant is still working on this message (status text, streaming tokens). */
  pending?: boolean;
}

/** Server-sent event payloads for POST /api/chat. */
export type ChatStreamEvent =
  | { type: "status"; text: string }
  | { type: "token"; text: string }
  | { type: "video"; url: string }
  | { type: "error"; text: string }
  | { type: "done" };
