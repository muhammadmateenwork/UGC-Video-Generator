import type { ChatMessage } from "@/lib/types";
import { PhoneVideo } from "./PhoneVideo";
import { SparkIcon } from "./icons";

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

function StatusRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5 text-ink-soft">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>
      <span className="text-[14px]">{text}</span>
    </div>
  );
}

function Avatar({ isUser }: { isUser: boolean }) {
  if (isUser) {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-border text-[11px] font-semibold text-ink-soft">
        You
      </div>
    );
  }
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-accent">
      <SparkIcon className="h-3.5 w-3.5" />
    </div>
  );
}

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const showTyping = !isUser && message.pending && !message.content && !message.status;

  return (
    <div className={`flex w-full animate-fade-up items-start gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <Avatar isUser={isUser} />
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed break-words whitespace-pre-wrap shadow-sm sm:max-w-[72%] ${
          isUser
            ? "rounded-tr-sm bg-ink text-background"
            : "rounded-tl-sm border border-border bg-surface text-foreground"
        }`}
      >
        {showTyping ? (
          <TypingDots />
        ) : !isUser && message.status && !message.content ? (
          <StatusRow text={message.status} />
        ) : (
          message.content
        )}
        {message.videoUrl && <PhoneVideo url={message.videoUrl} />}
      </div>
    </div>
  );
}
