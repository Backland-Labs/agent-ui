"use client";

import { useCopilotChat } from "@copilotkit/react-core";
import { Role, TextMessage } from "@copilotkit/runtime-client-gql";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import type { AgentConfig } from "@/lib/agents/types";

interface ChatThreadProps {
  threadId: string;
  agent: AgentConfig;
}

export function ChatThread({ threadId, agent }: ChatThreadProps) {
  const {
    visibleMessages,
    appendMessage,
    stopGeneration,
    isLoading,
  } = useCopilotChat({
    id: threadId,
  });

  // Transform CopilotKit messages to our format
  // Messages have isTextMessage() method and role/content properties
  const messages = visibleMessages
    .filter((msg) => {
      // Check if it's a text message with user or assistant role
      if ("isTextMessage" in msg && typeof msg.isTextMessage === "function") {
        return msg.isTextMessage() &&
          ("role" in msg && (msg.role === "user" || msg.role === "assistant"));
      }
      return false;
    })
    .map((msg) => ({
      id: msg.id,
      role: ("role" in msg && msg.role === "user") ? "user" as const : "assistant" as const,
      content: "content" in msg ? String(msg.content || "") : "",
    }));

  const handleSend = (content: string) => {
    appendMessage(new TextMessage({ content, role: Role.User }));
  };

  const handleStop = () => {
    stopGeneration();
  };

  return (
    <div className="flex flex-col h-full">
      <MessageList
        messages={messages}
        agentIcon={agent.icon}
        isLoading={isLoading}
      />
      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        isLoading={isLoading}
        placeholder={`Message ${agent.name}...`}
      />
    </div>
  );
}
