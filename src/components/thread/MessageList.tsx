"use client";

import { useEffect, useRef } from "react";
import { MessageSquare, AlertCircle } from "lucide-react";
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
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <MessageSquare className="h-6 w-6 mx-auto mb-2 text-muted-foreground/25" />
          <p className="text-xs">Send a message to start</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="flex flex-col py-4">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            role={message.role}
            content={message.content}
            agentIcon={agentIcon}
          />
        ))}
        {isLoading && (
          <MessageBubble role="assistant" content="" agentIcon={agentIcon} isStreaming />
        )}
        {error && (
          <div className="mx-6 my-3 flex items-center gap-3 rounded-lg bg-destructive/10 px-4 py-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            <span className="text-[13px] text-destructive flex-1">{error}</span>
            {onRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
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
