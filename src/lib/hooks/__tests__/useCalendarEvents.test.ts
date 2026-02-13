import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useCalendarEvents } from "../useCalendarEvents";
import type { CalendarResponse } from "@/types/calendar.types";

function createMockResponse(overrides: Partial<CalendarResponse> = {}): CalendarResponse {
  return {
    events: [],
    errors: [],
    fetchedAt: new Date().toISOString(),
    date: "2026-02-13",
    isConfigured: true,
    ...overrides,
  };
}

function mockFetchWith(response: Partial<CalendarResponse> = {}) {
  return vi.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(createMockResponse(response)),
  } as Response);
}

describe("useCalendarEvents", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches on mount with timezone parameter", async () => {
    const spy = mockFetchWith();

    const { result } = renderHook(() => useCalendarEvents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const url = spy.mock.calls[0][0] as string;
    expect(url).toMatch(/^\/api\/calendar\?tz=/);
  });

  it("starts with loading true and resolves to false", async () => {
    mockFetchWith();

    const { result } = renderHook(() => useCalendarEvents());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("sets events from response", async () => {
    const mockEvents = [
      {
        id: "1",
        title: "Test Event",
        startTime: "2026-02-13T10:00:00Z",
        endTime: "2026-02-13T11:00:00Z",
        isAllDay: false,
        account: "work",
        htmlLink: "https://calendar.google.com/event/1",
        meetLink: null,
      },
    ];

    mockFetchWith({ events: mockEvents });

    const { result } = renderHook(() => useCalendarEvents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].title).toBe("Test Event");
  });

  it("polls after 5 minutes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const spy = mockFetchWith();

    const { result } = renderHook(() => useCalendarEvents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(spy).toHaveBeenCalledTimes(1);

    // Advance time by 5 minutes
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(2);
    });

    vi.useRealTimers();
  });

  it("handles fetch failure gracefully", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useCalendarEvents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0].message).toBe("Failed to load calendar");
  });

  it("handles non-ok response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 502,
    } as Response);

    const { result } = renderHook(() => useCalendarEvents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.errors).toHaveLength(1);
  });

  it("returns isConfigured false from response", async () => {
    mockFetchWith({ isConfigured: false });

    const { result } = renderHook(() => useCalendarEvents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isConfigured).toBe(false);
  });

  it("refresh triggers immediate fetch", async () => {
    const spy = mockFetchWith();

    const { result } = renderHook(() => useCalendarEvents());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(spy).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });
});
