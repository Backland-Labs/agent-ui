"use client";

import { useSearchParams } from "next/navigation";
import { Inbox } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { InboxItem } from "./InboxItem";
import type { InboxItem as InboxItemType } from "@/types/database.types";

interface InboxListProps {
  threads: InboxItemType[];
  loading: boolean;
  activeThreadId?: string;
}

export function InboxList({ threads, loading, activeThreadId }: InboxListProps) {
  const searchParams = useSearchParams();
  const agentFilter = searchParams.get("agent");

  if (loading) {
    return (
      <div className="divide-y">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start gap-3.5 px-6 py-4">
            <Skeleton className="h-8 w-8 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-6">
        <Inbox className="h-6 w-6 text-muted-foreground/30 mb-3" />
        <h3 className="text-sm font-medium">No conversations</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {agentFilter
            ? "Start a new conversation with this agent"
            : "Select an agent to begin"}
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="divide-y">
        {threads.map((thread) => (
          <InboxItem
            key={thread.id}
            thread={thread}
            isActive={thread.id === activeThreadId}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
