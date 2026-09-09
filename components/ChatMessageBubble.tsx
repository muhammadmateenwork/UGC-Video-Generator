import type { ChatMessage } from "@/lib/types";
import { PhoneVideo } from "./PhoneVideo";
import { PipelineStepper } from "./PipelineStepper";
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

function Avatar({ isUser }: { isUser: boolean }) {
  if (isUser) {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-soft text-[11px] font-semibold text-ink-soft shadow-sm">
        You
      </div>
    );
  }
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-surface text-accent shadow-sm">
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
        className={`max-w-[82%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed break-words whitespace-pre-wrap shadow-[0_1px_2px_rgba(0,0,0,0.2),0_4px_10px_rgba(0,0,0,0.25)] sm:max-w-[72%] ${
          isUser
            ? "rounded-tr-sm bg-accent text-background"
            : "rounded-tl-sm border border-border bg-surface text-foreground"
        }`}
      >
        {showTyping ? (
          <TypingDots />
        ) : !isUser && message.status && !message.content ? (
          <PipelineStepper text={message.status} stage={message.stage} />
        ) : (
          message.content
        )}
        {message.videoUrl && <PhoneVideo url={message.videoUrl} />}
      </div>
    </div>
  );
}
