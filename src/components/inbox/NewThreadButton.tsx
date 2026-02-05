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

export function NewThreadButton({
  agents,
  onCreateThread,
  defaultAgentId,
}: NewThreadButtonProps) {
  const router = useRouter();
  const [selectedAgent, setSelectedAgent] = useState(
    defaultAgentId || agents[0]?.id || ""
  );
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!selectedAgent) return;

    try {
      setIsCreating(true);
      const thread = await onCreateThread(selectedAgent);
      router.push(`/thread/${thread.id}`);
    } catch (error) {
      console.error("Failed to create thread:", error);
    } finally {
      setIsCreating(false);
    }
  };

  if (agents.length === 1) {
    return (
      <Button onClick={handleCreate} disabled={isCreating}>
        <Plus className="h-4 w-4 mr-2" />
        {isCreating ? "Creating..." : "New Thread"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedAgent} onValueChange={setSelectedAgent}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select agent" />
        </SelectTrigger>
        <SelectContent>
          {agents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              <span className="mr-2">{agent.icon || "🤖"}</span>
              {agent.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={handleCreate} disabled={isCreating || !selectedAgent}>
        <Plus className="h-4 w-4 mr-2" />
        {isCreating ? "Creating..." : "New"}
      </Button>
    </div>
  );
}
