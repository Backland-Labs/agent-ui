"use client";

import Link from "next/link";
import { RefreshCw, MailOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { LandingInboxThreadPreview } from "@/types";

interface AgentInboxPreviewProps {
  threads: LandingInboxThreadPreview[];
  loading: boolean;
  error: string | null;
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

export function AgentInboxPreview({ threads, loading, error, refresh }: AgentInboxPreviewProps) {
  return (
    <section className="rounded-xl border border-border/30 bg-card/60 flex-1 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Inbox Preview</h2>
          <p className="font-mono text-[10px] text-muted-foreground/65">
            Top threads from this morning
          </p>
        </div>
        <button
          onClick={refresh}
          type="button"
          className="flex items-center gap-1 text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      {loading && !error ? <ThreadSkeleton /> : null}
      {loading && !error ? (
        <p className="mt-2 text-xs text-muted-foreground/60">Loading inbox preview...</p>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!loading && !error && threads.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-border/20 bg-accent/10 py-8 text-center px-2">
          <MailOpen className="h-5 w-5 text-muted-foreground/40 mb-2" />
          <p className="text-xs text-muted-foreground/60">All caught up.</p>
          <p className="text-[11px] text-muted-foreground/50 mt-1">
            No recent threads in the last 24 hours.
          </p>
        </div>
      ) : null}

      {!loading && !error && threads.length > 0 ? (
        <div className="space-y-0">
          {threads.map((thread, index) => (
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
