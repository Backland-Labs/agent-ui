"use client";

import { useCallback, useEffect, useState } from "react";
import { useDailyDigest } from "@/lib/hooks";
import { useCalendarEvents } from "@/lib/hooks/useCalendarEvents";
import { AgentInboxPreview } from "./AgentInboxPreview";
import { DailyDigestCard } from "./DailyDigestCard";
import { LandingCalendarCard } from "./LandingCalendarCard";
import type { LandingInboxThreadPreview } from "@/types";

function sanitizeThreadRole(role: string | null): "user" | "assistant" | "system" | null {
  if (role === "user" || role === "assistant" || role === "system") {
    return role;
  }

  return null;
}

function sanitizeSnippet(value: string | null): string {
  if (!value?.trim()) return "No messages yet";
  return value.length > 140 ? `${value.slice(0, 140)}…` : value;
}

export function LandingContent() {
  const {
    digest,
    loading: digestLoading,
    error: digestError,
    refresh: refreshDigest,
  } = useDailyDigest();
  const {
    events: calendarEvents,
    errors: calendarErrors,
    loading: calendarLoading,
    isConfigured: calendarConfigured,
    refresh: refreshCalendar,
  } = useCalendarEvents();

  const [threads, setThreads] = useState<LandingInboxThreadPreview[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [threadsError, setThreadsError] = useState<string | null>(null);

  const fetchThreads = useCallback(async () => {
    setThreadsLoading(true);

    try {
      const response = await fetch("/api/threads");

      if (!response.ok) {
        throw new Error("Unable to load inbox preview");
      }

      const data = (await response.json()) as Array<{
        id: string;
        agent_name: string;
        title: string | null;
        last_message: string | null;
        last_message_role: string | null;
        last_message_at: string | null;
        created_at: string;
      }>;

      setThreads(
        data.slice(0, 7).map((thread) => {
          const lastActivity = thread.last_message_at ?? thread.created_at;

          return {
            threadId: thread.id,
            agentName: thread.agent_name,
            title: thread.title || "Untitled conversation",
            snippet: sanitizeSnippet(thread.last_message),
            lastActivityAt: lastActivity,
            lastMessageRole: sanitizeThreadRole(thread.last_message_role),
          };
        })
      );
      setThreadsError(null);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setThreadsError("Unable to load inbox preview");
    } finally {
      setThreadsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchThreads();
  }, [fetchThreads]);

  return (
    <div className="flex h-full flex-col gap-4 p-4 lg:p-5">
      <div className="rounded-xl border border-border/30 bg-card/55 p-4">
        <h1 className="text-lg font-semibold text-foreground">Today&apos;s command center</h1>
        <p className="text-xs text-muted-foreground/65 mt-1">
          Daily digest, calendar, and inbox triage in one place.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <AgentInboxPreview
          threads={threads}
          loading={threadsLoading}
          error={threadsError}
          refresh={fetchThreads}
        />

        <div className="space-y-4">
          <DailyDigestCard
            digest={digest}
            loading={digestLoading}
            error={digestError}
            onRefresh={refreshDigest}
          />
          <LandingCalendarCard
            events={calendarEvents}
            errors={calendarErrors}
            loading={calendarLoading}
            isConfigured={calendarConfigured}
            refresh={refreshCalendar}
          />
        </div>
      </div>
    </div>
  );
}
