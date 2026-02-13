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
        <Button
          variant="outline"
          size="sm"
          className="w-full border-primary/25 text-primary hover:bg-primary/10 hover:border-primary/40 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          New Thread
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[380px] bg-card/90 backdrop-blur-xl border-border/40">
        <DialogHeader>
          <DialogTitle className="font-serif italic text-base">New conversation</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground/70">
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
            {isCreating ? "Creating..." : "Begin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
