"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { InboxItem as InboxItemType } from "@/types/database.types";

interface InboxItemProps {
  thread: InboxItemType;
  isActive?: boolean;
}

export function InboxItem({ thread, isActive }: InboxItemProps) {
  const lastActivityTime = thread.last_message_at || thread.created_at;
  const timeAgo = formatDistanceToNow(new Date(lastActivityTime), {
    addSuffix: true,
  });

  // Truncate last message to 100 characters
  const truncatedMessage = thread.last_message
    ? thread.last_message.length > 100
      ? thread.last_message.slice(0, 100) + "..."
      : thread.last_message
    : "No messages yet";

  return (
    <Link href={`/thread/${thread.id}`}>
      <Card
        className={`p-4 hover:bg-accent transition-colors cursor-pointer ${
          isActive ? "bg-accent border-primary" : ""
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="text-2xl">{thread.agent_icon || "🤖"}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium truncate">
                {thread.title || "Untitled conversation"}
              </h3>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {timeAgo}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {thread.agent_name}
            </p>
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {thread.last_message_role === "assistant" && (
                <span className="font-medium">Agent: </span>
              )}
              {truncatedMessage}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant={thread.status === "active" ? "default" : "secondary"}
              >
                {thread.status}
              </Badge>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
