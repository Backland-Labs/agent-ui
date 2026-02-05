"use client";

import { cn } from "@/lib/utils";
import { User, Bot } from "lucide-react";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  agentIcon?: string;
  isStreaming?: boolean;
}

export function MessageBubble({
  role,
  content,
  isStreaming,
}: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 px-6 py-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "h-7 w-7 rounded-md flex items-center justify-center shrink-0",
          isUser
            ? "bg-foreground text-background"
            : "bg-accent text-muted-foreground"
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div
        className={cn(
          "rounded-lg px-3.5 py-2.5 max-w-[75%] text-[13px] leading-relaxed",
          isUser
            ? "bg-foreground text-background"
            : "bg-accent text-foreground"
        )}
      >
        <div className="whitespace-pre-wrap break-words">
          {content}
          {isStreaming && (
            <span className="inline-block w-[3px] h-3.5 ml-0.5 bg-current opacity-60 rounded-full animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
