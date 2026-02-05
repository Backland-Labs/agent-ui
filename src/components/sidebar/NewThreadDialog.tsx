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

  const handleCreate = () => {
    if (!selectedAgent) return;

    // Generate a new thread ID
    const threadId = `thread-${Date.now()}`;

    // Navigate to the new thread with the selected agent
    router.push(`/thread/${threadId}?agent=${selectedAgent}`);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          New Thread
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Start a new conversation</DialogTitle>
          <DialogDescription>
            Choose an agent to start chatting with.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  <div className="flex items-center gap-2">
                    <span>{agent.icon || "🤖"}</span>
                    <div>
                      <div className="font-medium">{agent.name}</div>
                      {agent.description && (
                        <div className="text-xs text-muted-foreground">
                          {agent.description}
                        </div>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!selectedAgent}>
            Start Chat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
