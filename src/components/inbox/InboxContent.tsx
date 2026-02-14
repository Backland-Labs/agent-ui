"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { InboxList } from "./InboxList";
import { NewThreadButton } from "./NewThreadButton";
import type { AgentConfig } from "@/lib/agents/types";
import type { InboxThread } from "@/types";

interface InboxContentProps {
  agents: AgentConfig[];
}

export function InboxContent({ agents }: InboxContentProps) {
  const searchParams = useSearchParams();
  const agentFilter = searchParams.get("agent");
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchThreads() {
      try {
        const params = new URLSearchParams();
        if (agentFilter) params.set("agent", agentFilter);
        const res = await fetch(`/api/threads?${params}`);
        if (res.ok) {
          const data = await res.json();
          setThreads(data);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchThreads();
  }, [agentFilter]);

  const handleCreateThread = async (agentId: string) => {
    const res = await fetch("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, title: "New conversation" }),
    });
    const thread = await res.json();
    return { id: thread.id };
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
        <div>
          <h2 className="font-serif italic text-base text-foreground/90">
            {agentFilter
              ? `${agents.find((a) => a.id === agentFilter)?.name || "Agent"}`
              : "All Threads"}
          </h2>
          <p className="font-mono text-[10px] text-muted-foreground/60 mt-0.5 uppercase tracking-wider">
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
