"use client";

import { useAgentChat } from "@/lib/hooks/useAgentChat";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import type { AgentConfig } from "@/lib/agents/types";

interface ChatThreadProps {
  threadId: string;
  agent: AgentConfig;
}

export function ChatThread({ threadId, agent }: ChatThreadProps) {
  const { messages, isLoading, sendMessage, stopGeneration } = useAgentChat({
    threadId,
    agentId: agent.id,
  });

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} agentIcon={agent.icon} isLoading={isLoading} />
      <ChatInput
        onSend={sendMessage}
        onStop={stopGeneration}
        isLoading={isLoading}
        placeholder={`Message ${agent.name}...`}
      />
    </div>
  );
}
