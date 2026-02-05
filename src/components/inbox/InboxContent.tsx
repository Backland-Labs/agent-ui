"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { InboxList } from "./InboxList";
import { NewThreadButton } from "./NewThreadButton";
import type { AgentConfig } from "@/lib/agents/types";
import type { InboxItem } from "@/types/database.types";

interface InboxContentProps {
  agents: AgentConfig[];
}

// Mock data for development without Supabase
const mockThreads: InboxItem[] = [
  {
    id: "1",
    agent_id: "mock-assistant",
    title: "Hello World",
    status: "active",
    last_activity_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 3600000).toISOString(),
    agent_name: "Mock Assistant",
    agent_icon: null,
    last_message: "Hello! I'm a mock AI assistant for testing the Agent UI.",
    last_message_role: "assistant",
    last_message_at: new Date().toISOString(),
  },
  {
    id: "2",
    agent_id: "mock-assistant",
    title: "Code Discussion",
    status: "active",
    last_activity_at: new Date(Date.now() - 7200000).toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
    agent_name: "Mock Assistant",
    agent_icon: null,
    last_message: "The Agent UI is built with Next.js, TypeScript, and shadcn/ui...",
    last_message_role: "assistant",
    last_message_at: new Date(Date.now() - 7200000).toISOString(),
  },
];

export function InboxContent({ agents }: InboxContentProps) {
  const searchParams = useSearchParams();
  const agentFilter = searchParams.get("agent");
  const [threads, setThreads] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      // Filter threads by agent if filter is active
      const filteredThreads = agentFilter
        ? mockThreads.filter((t) => t.agent_id === agentFilter)
        : mockThreads;
      setThreads(filteredThreads);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [agentFilter]);

  const handleCreateThread = async (agentId: string) => {
    // Mock thread creation
    const newThread: InboxItem = {
      id: `thread-${Date.now()}`,
      agent_id: agentId,
      title: "New conversation",
      status: "active",
      last_activity_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      agent_name: agents.find((a) => a.id === agentId)?.name || "Unknown Agent",
      agent_icon: null,
      last_message: null,
      last_message_role: null,
      last_message_at: null,
    };

    setThreads((prev) => [newThread, ...prev]);
    return { id: newThread.id };
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h2 className="text-sm font-medium">
            {agentFilter
              ? `${agents.find((a) => a.id === agentFilter)?.name || "Agent"}`
              : "All Threads"}
          </h2>
          <p className="font-mono text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">
            {threads.length} conversation{threads.length !== 1 ? "s" : ""}
          </p>
        </div>
        <NewThreadButton
          agents={agents}
          onCreateThread={handleCreateThread}
          defaultAgentId={agentFilter || undefined}
        />
      </div>
      <div className="flex-1 overflow-hidden">
        <InboxList threads={threads} loading={loading} />
      </div>
    </div>
  );
}
