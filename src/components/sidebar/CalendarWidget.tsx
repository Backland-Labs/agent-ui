"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Video, Calendar } from "lucide-react";
import { SidebarGroup, SidebarGroupLabel, SidebarGroupContent } from "@/components/ui/sidebar";
import { useCalendarEvents } from "@/lib/hooks/useCalendarEvents";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types/calendar.types";

const ACCOUNT_COLORS: Record<number, string> = {
  0: "border-blue-400",
  1: "border-emerald-400",
};

const ACCOUNT_BG_COLORS: Record<number, string> = {
  0: "border-blue-400/80 bg-blue-400/5",
  1: "border-emerald-400/80 bg-emerald-400/5",
};

function getAccountIndex(event: CalendarEvent, accountLabels: string[]): number {
  const idx = accountLabels.indexOf(event.account);
  return idx >= 0 ? idx : 0;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? "p" : "a";
  const displayHour = hours % 12 || 12;
  if (minutes === 0) return `${displayHour}${period}`;
  return `${displayHour}:${minutes.toString().padStart(2, "0")}${period}`;
}

function isCurrentEvent(event: CalendarEvent, now: Date): boolean {
  if (event.isAllDay) return false;
  if (!event.startTime || !event.endTime) return false;
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  return now >= start && now <= end;
}

function isPastEvent(event: CalendarEvent, now: Date): boolean {
  if (event.isAllDay) return false;
  if (!event.endTime) return false;
  return now > new Date(event.endTime);
}

function CalendarSkeleton() {
  return (
    <div className="space-y-0 px-2">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="flex gap-2 py-2 animate-fade-in-up"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="w-0.5 shrink-0 rounded-full bg-accent/30" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 rounded bg-accent/30" style={{ width: `${40 - i * 5}%` }} />
            <div className="h-2.5 rounded bg-accent/20" style={{ width: `${70 - i * 8}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function NowDivider() {
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <div className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-breathe shadow-[0_0_6px_1px] shadow-primary/30" />
      <div className="flex-1 h-px bg-primary/20" />
      <span className="font-mono text-[9px] uppercase tracking-widest text-primary/40">Now</span>
      <div className="flex-1 h-px bg-primary/20" />
    </div>
  );
}

function EventRow({
  event,
  accountIndex,
  isCurrent,
  isPast,
}: {
  event: CalendarEvent;
  accountIndex: number;
  isCurrent: boolean;
  isPast: boolean;
}) {
  const borderColor = isCurrent
    ? ACCOUNT_BG_COLORS[accountIndex] || ACCOUNT_BG_COLORS[0]
    : ACCOUNT_COLORS[accountIndex] || ACCOUNT_COLORS[0];

  return (
    <a
      href={event.htmlLink}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex gap-2 px-2 py-1.5 rounded-sm transition-colors hover:bg-accent/30",
        isCurrent && "bg-accent/10",
        isPast && "opacity-50"
      )}
      title={`${event.account}: ${event.title}`}
    >
      <div className={cn("w-0.5 shrink-0 rounded-full border-l-2", borderColor)} />
      <div className="flex-1 min-w-0">
        {event.isAllDay ? (
          <p className="text-[11px] font-medium text-foreground/80 truncate">{event.title}</p>
        ) : (
          <>
            <p className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
              {event.startTime && formatTime(event.startTime)}
              {event.startTime && event.endTime && " - "}
              {event.endTime && formatTime(event.endTime)}
            </p>
            <p className="text-[11px] text-foreground/80 truncate leading-tight">{event.title}</p>
          </>
        )}
      </div>
      {event.meetLink && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(event.meetLink!, "_blank", "noopener,noreferrer");
          }}
          className="shrink-0 self-center opacity-0 group-hover:opacity-60 transition-opacity"
          title="Join meeting"
        >
          <Video className="h-3 w-3" />
        </button>
      )}
    </a>
  );
}

export function CalendarWidget() {
  const { events, errors, loading, isConfigured, refresh } = useCalendarEvents();
  const [now, setNow] = useState(() => new Date());

  // Tick every 60s to update current-event highlighting
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Don't render if calendar is not configured
  if (!isConfigured && !loading) return null;

  const accountLabels = [...new Set(events.map((e) => e.account))];
  const hasError = errors.length > 0 && events.length === 0;

  // Find where to insert the "Now" divider (between past and future timed events)
  let nowDividerIndex = -1;
  if (events.length > 0) {
    for (let i = 0; i < events.length; i++) {
      if (!events[i].isAllDay && !isPastEvent(events[i], now)) {
        // Insert now divider before first non-past event, but after all-day events
        if (i > 0 && !events[i - 1].isAllDay) {
          nowDividerIndex = i;
        }
        break;
      }
    }
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
        <span className="flex-1">Today</span>
        <button
          onClick={refresh}
          disabled={loading}
          className={cn(
            "p-0.5 rounded hover:bg-accent/40 transition-colors text-muted-foreground/40 hover:text-muted-foreground/60",
            loading && "animate-spin"
          )}
          title="Refresh calendar"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <div className="max-h-80 overflow-y-auto">
          {loading && events.length === 0 ? (
            <CalendarSkeleton />
          ) : hasError ? (
            <div className="flex flex-col items-center py-6 px-4 text-center">
              <Calendar className="h-5 w-5 text-muted-foreground/30 mb-2" />
              <p className="text-[11px] text-muted-foreground/50">Couldn&apos;t load calendar</p>
              <button
                onClick={refresh}
                className="mt-2 text-[10px] text-primary/60 hover:text-primary/80 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center py-6 px-4 text-center">
              <Calendar className="h-5 w-5 text-muted-foreground/30 mb-2" />
              <p className="text-[11px] text-muted-foreground/50">No events today</p>
            </div>
          ) : (
            <div className="py-1">
              {events.map((event, i) => (
                <div key={event.id}>
                  {i === nowDividerIndex && <NowDivider />}
                  <EventRow
                    event={event}
                    accountIndex={getAccountIndex(event, accountLabels)}
                    isCurrent={isCurrentEvent(event, now)}
                    isPast={isPastEvent(event, now)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
