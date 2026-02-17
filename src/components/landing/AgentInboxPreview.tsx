"use client";

import Link from "next/link";
import { RefreshCw, MailOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { LandingNarrativeItem, LandingNarrativeState } from "@/types";

interface AgentInboxPreviewProps {
  items: LandingNarrativeItem[];
  state: LandingNarrativeState;
  terminalError: string | null;
  refreshError: string | null;
  isRefreshing: boolean;
  refresh: () => void;
}

function getInitial(value: string): string {
  return value.charAt(0).toUpperCase() || "A";
}

function ThreadSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(4)].map((_, index) => (
        <div
          key={index}
          className="flex gap-2 items-start animate-fade-in-up"
          style={{ animationDelay: `${index * 70}ms` }}
        >
          <div className="h-8 w-8 rounded-full bg-accent/45" />
          <div className="flex-1 space-y-1">
            <div className="h-3 rounded bg-accent/35" style={{ width: `${70 - index * 10}%` }} />
            <div className="h-2 rounded bg-accent/25" style={{ width: `${50 - index * 7}%` }} />
            <div className="h-2 rounded bg-accent/20" style={{ width: `${90 - index * 8}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function isValidThreadId(item: LandingNarrativeItem): boolean {
  return item.threadId.trim().length > 0;
}

export function AgentInboxPreview({
  items,
  state,
  terminalError,
  refreshError,
  isRefreshing,
  refresh,
}: AgentInboxPreviewProps) {
  const threadItems = items.filter(isValidThreadId);

  return (
    <section className="rounded-xl border border-border/30 bg-card/60 flex-1 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Email Narrative</h2>
          <p className="font-mono text-[10px] text-muted-foreground/65">
            Recent thread summaries from the email agent
          </p>
        </div>
        <button
          onClick={refresh}
          type="button"
          disabled={state === "initial_loading" || isRefreshing}
          className="flex items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          <RefreshCw className={isRefreshing ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {refreshError ? (
        <div className="mb-3 flex items-center justify-between rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <span>{refreshError}</span>
          <button
            onClick={refresh}
            type="button"
            className="font-medium text-destructive/90 hover:text-destructive transition-colors"
          >
            Retry
          </button>
        </div>
      ) : null}

      {state === "initial_loading" ? <ThreadSkeleton /> : null}
      {state === "initial_loading" ? (
        <p className="mt-2 text-xs text-muted-foreground/60">Loading email narrative...</p>
      ) : null}

      {state === "terminal_error" && terminalError ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {terminalError}
        </div>
      ) : null}

      {state === "empty" ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-border/20 bg-accent/10 py-8 text-center px-2">
          <MailOpen className="h-5 w-5 text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground/60">All caught up.</p>
          <p className="text-[11px] text-muted-foreground/50 mt-1">
            No recent items to triage from the email agent.
          </p>
        </div>
      ) : null}

      {state === "success" && threadItems.length > 0 ? (
        <div className="space-y-0">
          {threadItems.map((thread, index) => (
            <Link
              key={thread.threadId}
              href={`/thread/${thread.threadId}`}
              className="flex items-start gap-3 border-b border-border/20 py-2.5 last:border-none hover:bg-accent/20 rounded-sm px-1 -mx-1 transition-colors animate-fade-in-up"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className="h-7 w-7 shrink-0 rounded-full bg-accent border border-border/40 flex items-center justify-center text-[11px] font-medium">
                {getInitial(thread.agentName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-foreground/90 truncate">{thread.title}</p>
                  <span className="font-mono text-[10px] text-muted-foreground/55 whitespace-nowrap">
                    {formatDistanceToNow(new Date(thread.lastActivityAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground/70">{thread.agentName}</p>
                <p className="text-xs text-muted-foreground/55 line-clamp-1">{thread.snippet}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-3">
        <Link
          href="/inbox"
          className="text-[11px] font-medium text-primary/80 hover:text-primary transition-colors"
        >
          Open full inbox →
        </Link>
      </div>
    </section>
  );
}
