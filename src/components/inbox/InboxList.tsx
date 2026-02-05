"use client";

import { useSearchParams } from "next/navigation";
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
      <div className="space-y-3 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-4 border rounded-lg">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <div className="text-4xl mb-4">📭</div>
        <h3 className="font-medium text-lg">No conversations yet</h3>
        <p className="text-muted-foreground mt-2">
          {agentFilter
            ? "Start a new conversation with this agent"
            : "Select an agent from the sidebar to start chatting"}
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-4">
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
