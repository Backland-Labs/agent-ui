"use client";

import { cn } from "@/lib/utils";
import { User, Bot } from "lucide-react";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  agentIcon?: string;
  isStreaming?: boolean;
}

export function MessageBubble({ role, content, isStreaming }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-3 px-6 py-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-colors",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border/50 text-muted-foreground"
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div
        className={cn(
          "text-[13px] leading-relaxed",
          isUser
            ? "rounded-2xl px-4 py-2.5 max-w-[70%] bg-primary/10 border border-primary/15 text-foreground"
            : "max-w-[85%] border-l-2 border-primary/15 pl-3.5 py-1 text-foreground/85"
        )}
      >
        <div className="whitespace-pre-wrap break-words">
          {content}
          {isStreaming && (
            <span className="inline-block w-1.5 h-1.5 ml-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_2px] shadow-primary/40 align-middle" />
          )}
        </div>
      </div>
    </div>
  );
}
