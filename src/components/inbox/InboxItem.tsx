"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { InboxItem as InboxItemType } from "@/types/database.types";

interface InboxItemProps {
  thread: InboxItemType;
  isActive?: boolean;
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

export function InboxItem({ thread, isActive }: InboxItemProps) {
  const lastActivityTime = thread.last_message_at || thread.created_at;
  const timeAgo = formatDistanceToNow(new Date(lastActivityTime), {
    addSuffix: true,
  });

  const truncatedMessage = thread.last_message
    ? thread.last_message.length > 100
      ? thread.last_message.slice(0, 100) + "..."
      : thread.last_message
    : "No messages yet";

  return (
    <Link href={`/thread/${thread.id}`}>
      <div
        className={`group flex items-start gap-3.5 px-6 py-4 border-b transition-colors cursor-pointer ${
          isActive ? "bg-accent" : "hover:bg-accent/50"
        }`}
      >
        <div className="h-8 w-8 rounded-md bg-foreground text-background flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
          {getInitial(thread.agent_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[13px] font-medium truncate">
              {thread.title || "Untitled conversation"}
            </h3>
            <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
              {timeAgo}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{thread.agent_name}</p>
          <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-1">{truncatedMessage}</p>
        </div>
      </div>
    </Link>
  );
}
