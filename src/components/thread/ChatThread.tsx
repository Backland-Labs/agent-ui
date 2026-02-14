"use client";

import { useCallback } from "react";
import { useAgentChat } from "@/lib/hooks/useAgentChat";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import type { AgentConfig } from "@/lib/agents/types";

interface ChatThreadProps {
  threadId: string;
  agent: AgentConfig;
}

export function ChatThread({ threadId, agent }: ChatThreadProps) {
  const { messages, isLoading, error, sendMessage, stopGeneration } = useAgentChat({
    threadId,
    agentId: agent.id,
  });

  const handleRetry = useCallback(() => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMessage) {
      sendMessage(lastUserMessage.content);
    }
  }, [messages, sendMessage]);

  return (
    <div className="flex flex-col h-full">
      <MessageList
        messages={messages}
        agentIcon={agent.icon}
        isLoading={isLoading}
        error={error}
        onRetry={handleRetry}
      />
      <ChatInput
        onSend={sendMessage}
        onStop={stopGeneration}
        isLoading={isLoading}
        placeholder={`Message ${agent.name}...`}
      />
    </div>
  );
}
