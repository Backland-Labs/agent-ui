"use client";

import { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
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
}

export function MessageList({ messages, agentIcon, isLoading }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

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
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
