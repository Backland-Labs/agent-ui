"use client";

import Link from "next/link";
import { RefreshCw, Calendar, CalendarClock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { CalendarEvent, AccountError } from "@/types/calendar.types";

interface LandingCalendarCardProps {
  events: CalendarEvent[];
  errors: AccountError[];
  loading: boolean;
  isConfigured: boolean;
  refresh: () => void;
}

function formatTime(isoString: string | null): string {
  if (!isoString) return "time";
  const date = new Date(isoString);
  return date
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })
    .toLowerCase();
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "time";
  return formatDistanceToNow(new Date(isoString), { addSuffix: true });
}

export function LandingCalendarCard({
  events,
  errors,
  loading,
  isConfigured,
  refresh,
}: LandingCalendarCardProps) {
  const hasError = errors.length > 0 && events.length === 0;
  const hasContent = events.length > 0;

  if (!isConfigured && !loading) return null;

  return (
    <section className="rounded-xl border border-border/30 bg-card/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Today&apos;s Calendar</h2>
        <button
          onClick={refresh}
          type="button"
          disabled={loading}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 hover:text-foreground transition-colors"
          title="Refresh calendar"
        >
          <RefreshCw className={loading ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
          Refresh
        </button>
      </div>

      {loading && events.length === 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground/65">Loading calendar...</p>
          {[...Array(4)].map((_, index) => (
            <div
              key={index}
              className="h-10 rounded-md bg-accent/30 animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            />
          ))}
        </div>
      ) : hasError ? (
        <div className="mt-5 flex flex-col items-center text-center">
          <Calendar className="h-5 w-5 text-muted-foreground/45 mb-2" />
          <p className="text-xs text-muted-foreground/65">Couldn&apos;t load calendar events.</p>
          <button
            onClick={refresh}
            className="mt-2 text-[11px] text-primary/65 hover:text-primary transition-colors"
            type="button"
          >
            Retry
          </button>
        </div>
      ) : !hasContent ? (
        <div className="mt-5 flex flex-col items-center text-center">
          <CalendarClock className="h-5 w-5 text-muted-foreground/45 mb-2" />
          <p className="text-xs text-muted-foreground/60">No calendar items for today.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-1.5">
          {events.slice(0, 6).map((event) => (
            <a
              key={event.id}
              href={event.htmlLink}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md border border-border/20 px-2.5 py-2 hover:bg-accent/25 transition-colors"
            >
              <p className="text-xs text-foreground/90 truncate">{event.title}</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">
                {event.isAllDay ? "All day" : `${formatTime(event.startTime)} • ${event.account}`}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground/45 mt-0.5">
                Starts {formatRelativeTime(event.startTime)}
              </p>
            </a>
          ))}
        </div>
      )}

      <Link
        href="/inbox"
        className="mt-3 inline-flex text-[11px] font-medium text-primary/80 hover:text-primary transition-colors"
      >
        Open inbox to act on any thread →
      </Link>
    </section>
  );
}
