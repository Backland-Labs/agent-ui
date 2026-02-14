"use client";

import { useSearchParams } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InboxItem } from "./InboxItem";
import type { InboxThread } from "@/types";

interface InboxListProps {
  threads: InboxThread[];
  loading: boolean;
  activeThreadId?: string;
}

export function InboxList({ threads, loading, activeThreadId }: InboxListProps) {
  const searchParams = useSearchParams();
  const agentFilter = searchParams.get("agent");

  if (loading) {
    return (
      <div className="space-y-0">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3.5 px-6 py-4 border-b border-border/20 animate-fade-in-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="h-8 w-8 rounded-full bg-accent/50 shrink-0" />
            <div className="flex-1 space-y-2.5">
              <div className="h-3 rounded-lg bg-accent/40" style={{ width: `${65 - i * 8}%` }} />
              <div className="h-2.5 w-1/4 rounded-lg bg-accent/25" />
              <div className="h-2.5 w-full rounded-lg bg-accent/15" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-6">
        <div className="w-12 h-12 rounded-full border border-border/30 flex items-center justify-center mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-breathe shadow-[0_0_8px_2px] shadow-primary/20" />
        </div>
        <h3 className="font-serif italic text-lg text-foreground/50">Silence</h3>
        <p className="text-xs text-muted-foreground/55 mt-2 max-w-48">
          {agentFilter ? "Begin a conversation with this agent" : "Select an agent to begin"}
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div>
        {threads.map((thread, index) => (
          <div
            key={thread.id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <InboxItem thread={thread} isActive={thread.id === activeThreadId} />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
