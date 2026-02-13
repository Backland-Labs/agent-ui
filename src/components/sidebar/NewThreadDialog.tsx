"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AgentConfig } from "@/lib/agents/types";

interface NewThreadDialogProps {
  agents: AgentConfig[];
}

export function NewThreadDialog({ agents }: NewThreadDialogProps) {
  const router = useRouter();
  const [selectedAgent, setSelectedAgent] = useState(agents[0]?.id || "");
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!selectedAgent) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent,
          title: "New conversation",
        }),
      });

      if (!res.ok) throw new Error("Failed to create thread");

      const thread = await res.json();
      router.push(`/thread/${thread.id}`);
      setIsOpen(false);
    } catch {
      // Thread creation failed - dialog stays open
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Plus className="h-3.5 w-3.5" />
          New Thread
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">New conversation</DialogTitle>
          <DialogDescription className="text-xs">
            Choose an agent to start chatting with.
          </DialogDescription>
        </DialogHeader>
        <div className="py-3">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  <div>
                    <div className="text-sm">{agent.name}</div>
                    {agent.description && (
                      <div className="text-xs text-muted-foreground">{agent.description}</div>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={!selectedAgent || isCreating}>
            {isCreating ? "Creating..." : "Start"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
