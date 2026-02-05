"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { ChatThread } from "@/components/thread";
import type { AgentConfig } from "@/lib/agents/types";

interface ThreadContentProps {
  threadId: string;
  agent: AgentConfig;
}

export function ThreadContent({ threadId, agent }: ThreadContentProps) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent={agent.id}>
      <ChatThread threadId={threadId} agent={agent} />
    </CopilotKit>
  );
}
