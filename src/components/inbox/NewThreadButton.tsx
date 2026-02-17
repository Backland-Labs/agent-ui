"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AgentConfig } from "@/lib/agents/types";

interface NewThreadButtonProps {
  agents: AgentConfig[];
  onCreateThread: (agentId: string) => Promise<{ id: string }>;
  defaultAgentId?: string;
}

export function NewThreadButton({ agents, onCreateThread, defaultAgentId }: NewThreadButtonProps) {
  const router = useRouter();
  const [selectedAgent, setSelectedAgent] = useState(defaultAgentId || agents[0]?.id || "");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!selectedAgent) return;

    try {
      setCreateError(null);
      setIsCreating(true);
      const thread = await onCreateThread(selectedAgent);

      if (!thread?.id) {
        throw new Error("Thread creation did not return a valid id");
      }

      router.push(`/thread/${thread.id}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create thread");
    } finally {
      setIsCreating(false);
    }
  };

  if (agents.length === 1) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button size="sm" onClick={handleCreate} disabled={isCreating}>
          <Plus className="h-3.5 w-3.5" />
          {isCreating ? "Creating..." : "New"}
        </Button>
        {createError ? <p className="text-[10px] text-destructive/80">{createError}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <Select
          value={selectedAgent}
          onValueChange={(value) => {
            setSelectedAgent(value);
            setCreateError(null);
          }}
        >
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder="Select agent" />
          </SelectTrigger>
          <SelectContent>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={handleCreate} disabled={isCreating || !selectedAgent}>
          <Plus className="h-3.5 w-3.5" />
          {isCreating ? "..." : "New"}
        </Button>
      </div>
      {createError ? <p className="text-[10px] text-destructive/80">{createError}</p> : null}
    </div>
  );
}
