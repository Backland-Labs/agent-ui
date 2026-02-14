"use client";

import Link from "next/link";
import { RefreshCw, Bell, Bot } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { DailyDigest } from "@/types";

interface DailyDigestCardProps {
  digest: DailyDigest | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function DigestSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(4)].map((_, index) => (
        <div
          key={index}
          className="h-4 rounded bg-accent/30 animate-fade-in-up"
          style={{
            width: index === 0 ? "72%" : index === 1 ? "55%" : "64%",
            animationDelay: `${index * 50}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function DailyDigestCard({ digest, loading, error, onRefresh }: DailyDigestCardProps) {
  if (error) {
    return (
      <section className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Daily Digest</h2>
          <button
            onClick={onRefresh}
            className="font-mono text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
            type="button"
          >
            Retry
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground/70">Unable to refresh digest right now.</p>
      </section>
    );
  }

  if (loading && !digest) {
    return (
      <section className="rounded-xl border border-border/30 bg-card/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Daily Digest</h2>
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground/50" />
        </div>
        <p className="text-xs text-muted-foreground/65">Loading digest...</p>
        <DigestSkeleton />
      </section>
    );
  }

  const metrics = digest?.metrics ?? [];
  const topItems = digest?.topItems ?? [];

  return (
    <section className="rounded-xl border border-border/30 bg-card/60 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Daily Digest</h2>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors"
          type="button"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      {metrics.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {metrics.map((metric) => (
            <div
              key={metric.key}
              className="rounded-lg border border-border/20 bg-accent/30 px-2 py-1.5"
            >
              <p className="font-mono text-[11px] text-muted-foreground/70 uppercase tracking-wide">
                {metric.label}
              </p>
              <p className="text-lg font-semibold mt-0.5">{metric.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground/70">No activity tracked in the last 24h.</p>
      )}

      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground/75">
          <Bell className="h-3.5 w-3.5" />
          Recent triage items
        </h3>

        {topItems.length === 0 ? (
          <p className="text-xs text-muted-foreground/60">All caught up.</p>
        ) : (
          <div className="space-y-2">
            {topItems.map((item) => (
              <article
                key={item.threadId}
                className="rounded-md border border-border/20 px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] text-foreground/90 truncate" title={item.subject}>
                    {item.subject}
                  </p>
                  <span className="font-mono text-[9px] text-muted-foreground/50 whitespace-nowrap">
                    {formatDistanceToNow(new Date(item.lastActivityAt), { addSuffix: true })}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground/70 truncate">{item.agentName}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60">
                    <Bot className="h-3 w-3" />
                    {item.lastMessageRole ?? "no message"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground/50 line-clamp-2">{item.snippet}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      <Link
        href="/inbox"
        className="inline-flex text-[11px] font-medium text-primary/80 hover:text-primary transition-colors"
      >
        Open full inbox →
      </Link>
    </section>
  );
}
