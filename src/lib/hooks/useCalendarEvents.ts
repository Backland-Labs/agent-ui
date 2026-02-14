"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { CalendarEvent, AccountError, CalendarResponse } from "@/types/calendar.types";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface UseCalendarEventsReturn {
  events: CalendarEvent[];
  errors: AccountError[];
  loading: boolean;
  isConfigured: boolean;
  refresh: () => void;
}

export function useCalendarEvents(): UseCalendarEventsReturn {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [errors, setErrors] = useState<AccountError[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tzRef = useRef(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const mountedRef = useRef(true);

  const fetchEvents = useCallback(async () => {
    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      const res = await fetch(`/api/calendar?tz=${encodeURIComponent(tzRef.current)}`, {
        signal: controller.signal,
      });

      // Guard: if a newer fetch replaced us, discard this response
      if (!mountedRef.current || abortRef.current !== controller) return;

      if (res.ok) {
        const data: CalendarResponse = await res.json();
        // Re-check after async json parse
        if (!mountedRef.current || abortRef.current !== controller) return;
        setEvents(data.events);
        setErrors(data.errors);
        setIsConfigured(data.isConfigured);
      } else {
        setErrors([{ account: "", message: "Failed to load calendar" }]);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (!mountedRef.current) return;
      setErrors([{ account: "", message: "Failed to load calendar" }]);
    } finally {
      if (mountedRef.current && abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, []);

  const schedulePoll = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      fetchEvents().finally(() => {
        if (mountedRef.current) schedulePoll();
      });
    }, POLL_INTERVAL_MS);
  }, [fetchEvents]);

  const refresh = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    fetchEvents().finally(() => {
      if (mountedRef.current) schedulePoll();
    });
  }, [fetchEvents, schedulePoll]);

  // Initial fetch + polling setup
  useEffect(() => {
    mountedRef.current = true;

    fetchEvents().finally(() => {
      if (mountedRef.current) schedulePoll();
    });

    // Page Visibility handling
    const handleVisibility = () => {
      if (document.hidden) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      } else {
        fetchEvents().finally(() => {
          if (mountedRef.current) schedulePoll();
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchEvents, schedulePoll]);

  return { events, errors, loading, isConfigured, refresh };
}
