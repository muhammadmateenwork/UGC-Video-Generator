import type { ChatMessage } from "@/lib/types";
import { PhoneVideo } from "./PhoneVideo";

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-ink-soft"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const showTyping = !isUser && message.pending && !message.content;

  return (
    <div className={`flex w-full animate-fade-up ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed break-words whitespace-pre-wrap sm:max-w-[75%] ${
          isUser
            ? "bg-ink text-background"
            : "border border-border bg-surface text-foreground"
        }`}
      >
        {showTyping ? <TypingDots /> : message.content}
        {message.videoUrl && <PhoneVideo url={message.videoUrl} />}
      </div>
    </div>
  );
}
