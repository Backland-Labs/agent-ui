"use client";

import { useDailyDigest, useNarrative } from "@/lib/hooks";
import { useCalendarEvents } from "@/lib/hooks/useCalendarEvents";
import { AgentInboxPreview } from "./AgentInboxPreview";
import { DailyDigestCard } from "./DailyDigestCard";
import { LandingCalendarCard } from "./LandingCalendarCard";

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
  const {
    narrative,
    actionItems,
    state: narrativeState,
    error: narrativeTerminalError,
    refreshError: narrativeRefreshError,
    isRefreshing: narrativeIsRefreshing,
    refresh: refreshNarratives,
  } = useNarrative();

  return (
    <div className="flex h-full flex-col gap-4 p-4 lg:p-5">
      <div className="rounded-xl border border-border/30 bg-card/55 p-4">
        <h1 className="text-lg font-semibold text-foreground">Today&apos;s command center</h1>
        <p className="text-xs text-muted-foreground/65 mt-1">
          Daily digest, calendar, and email narrative in one place.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <AgentInboxPreview
          narrative={narrative}
          actionItems={actionItems}
          state={narrativeState}
          terminalError={narrativeTerminalError}
          refreshError={narrativeRefreshError}
          isRefreshing={narrativeIsRefreshing}
          refresh={refreshNarratives}
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
