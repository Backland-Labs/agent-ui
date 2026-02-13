"use client";

import { useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./MessageBubble";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface MessageListProps {
  messages: Message[];
  agentIcon?: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function MessageList({ messages, agentIcon, isLoading, error, onRetry }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, error]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="font-serif italic text-3xl text-foreground/8 select-none">begin</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="flex flex-col py-4">
        {messages.map((message, index) => (
          <div
            key={message.id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
          >
            <MessageBubble role={message.role} content={message.content} agentIcon={agentIcon} />
          </div>
        ))}
        {isLoading && (
          <MessageBubble role="assistant" content="" agentIcon={agentIcon} isStreaming />
        )}
        {error && (
          <div className="mx-6 my-3 flex items-center gap-3 rounded-xl bg-destructive/8 border border-destructive/15 px-4 py-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive/70" />
            <span className="text-[13px] text-destructive/80 flex-1">{error}</span>
            {onRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                className="h-7 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10"
              >
                Retry
              </Button>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
