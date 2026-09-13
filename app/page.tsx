"use client";

import { useEffect, useRef, useState } from "react";
import { LandingHero } from "@/components/LandingHero";
import { ChatMessageBubble } from "@/components/ChatMessageBubble";
import { ChatInput } from "@/components/ChatInput";
import { SparkIcon, PlusIcon } from "@/components/icons";
import type { ChatMessage, ChatStreamEvent } from "@/lib/types";

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function streamChat(
  message: string,
  onEvent: (event: ChatStreamEvent) => void
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!res.ok || !res.body) {
    onEvent({ type: "error", text: `Request failed (${res.status})` });
    onEvent({ type: "done" });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.trim();
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      if (!json) continue;
      try {
        onEvent(JSON.parse(json) as ChatStreamEvent);
      } catch {
        // ignore malformed SSE frame
      }
    }
  }
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend(text: string) {
    const userMessage: ChatMessage = { id: makeId(), role: "user", content: text };
    const assistantId = makeId();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      pending: true,
    };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setPendingId(assistantId);

    let sawToken = false;

    const applyPatch = (patch: Partial<ChatMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m))
      );
    };

    try {
      await streamChat(text, (event) => {
        switch (event.type) {
          case "status":
            if (!sawToken) applyPatch({ status: event.text, stage: event.stage });
            break;
          case "token":
            if (!sawToken) {
              sawToken = true;
              applyPatch({ content: event.text, status: undefined });
            } else {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + event.text } : m
                )
              );
            }
            break;
          case "video":
            applyPatch({ videoUrl: event.url });
            break;
          case "error":
            applyPatch({ content: `Something went wrong: ${event.text}`, status: undefined });
            break;
          case "done":
            applyPatch({ pending: false });
            break;
        }
      });
    } catch {
      applyPatch({
        content: "Something went wrong reaching the server.",
        status: undefined,
        pending: false,
      });
    } finally {
      setPendingId(null);
    }
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="relative flex h-screen flex-col bg-background">
      <div className="bg-grain pointer-events-none absolute inset-0 -z-10" />
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-background">
          <SparkIcon className="h-4 w-4" />
        </div>
        <span className="font-display text-base font-bold text-foreground">
          UGC <span className="text-accent">Video</span> Generator
        </span>
        {hasMessages && (
          <button
            onClick={() => {
              setMessages([]);
              setInputValue("");
            }}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:border-accent/40 hover:text-ink"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            New chat
          </button>
        )}
      </header>

      {hasMessages ? (
        <>
          <div ref={scrollRef} className="fade-edges flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6 sm:px-6">
              {messages.map((m) => (
                <ChatMessageBubble key={m.id} message={m} />
              ))}
            </div>
          </div>

          <div className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-6">
            <div className="mx-auto w-full max-w-2xl">
              <ChatInput
                value={inputValue}
                onValueChange={setInputValue}
                onSend={handleSend}
                disabled={pendingId !== null}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col overflow-y-auto">
          <LandingHero
            value={inputValue}
            onValueChange={setInputValue}
            onSend={handleSend}
            disabled={pendingId !== null}
          />
        </div>
      )}
    </div>
  );
}
