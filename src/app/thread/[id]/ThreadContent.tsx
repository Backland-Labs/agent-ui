"use client";

import { ChatThread } from "@/components/thread";
import type { AgentConfig } from "@/lib/agents/types";

interface ThreadContentProps {
  threadId: string;
  agent: AgentConfig;
}

export function ThreadContent({ threadId, agent }: ThreadContentProps) {
  return <ChatThread threadId={threadId} agent={agent} />;
}
