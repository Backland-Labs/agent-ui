import { describe, it, expect, vi } from "vitest";
import { handleGetCalendarEvents } from "../route";
import type { CalendarResponse } from "@/types/calendar.types";

// Mock the server-only module so it doesn't throw in test environment
vi.mock("@/lib/server/google-calendar", () => ({
  fetchTodayEvents: vi.fn(),
}));

function mockFetcher(response: Partial<CalendarResponse>) {
  const base: CalendarResponse = {
    events: [],
    errors: [],
    fetchedAt: new Date().toISOString(),
    date: "2026-02-13",
    isConfigured: true,
    ...response,
  };
  return vi.fn().mockResolvedValue(base);
}

describe("GET /api/calendar", () => {
  it("returns events from fetcher", async () => {
    const fetcher = mockFetcher({
      events: [
        {
          id: "1",
          title: "Morning standup",
          startTime: "2026-02-13T09:00:00-05:00",
          endTime: "2026-02-13T09:30:00-05:00",
          isAllDay: false,
          account: "work",
          htmlLink: "https://calendar.google.com/event/1",
          meetLink: null,
        },
        {
          id: "2",
          title: "All day event",
          startTime: null,
          endTime: null,
          isAllDay: true,
          account: "personal",
          htmlLink: "https://calendar.google.com/event/2",
          meetLink: null,
        },
      ],
    });

    const response = await handleGetCalendarEvents(fetcher, "America/New_York");
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.events).toHaveLength(2);
    expect(data.isConfigured).toBe(true);
    expect(fetcher).toHaveBeenCalledWith("America/New_York");
  });

  it("returns 200 with partial data when one account fails", async () => {
    const fetcher = mockFetcher({
      events: [
        {
          id: "1",
          title: "Event from working account",
          startTime: "2026-02-13T10:00:00Z",
          endTime: "2026-02-13T11:00:00Z",
          isAllDay: false,
          account: "personal",
          htmlLink: "https://calendar.google.com/event/1",
          meetLink: null,
        },
      ],
      errors: [{ account: "work", message: "Failed to fetch events" }],
    });

    const response = await handleGetCalendarEvents(fetcher, "UTC");
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.events).toHaveLength(1);
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0].message).toBe("Failed to fetch events");
  });

  it("returns 502 when all accounts fail", async () => {
    const fetcher = mockFetcher({
      events: [],
      errors: [
        { account: "personal", message: "Failed to fetch events" },
        { account: "work", message: "Failed to fetch events" },
      ],
    });

    const response = await handleGetCalendarEvents(fetcher, "UTC");
    expect(response.status).toBe(502);
  });

  it("falls back to UTC for invalid timezone", async () => {
    const fetcher = mockFetcher({ events: [] });

    await handleGetCalendarEvents(fetcher, "Invalid/Timezone");

    expect(fetcher).toHaveBeenCalledWith("UTC");
  });

  it("uses UTC when no timezone provided", async () => {
    const fetcher = mockFetcher({ events: [] });

    await handleGetCalendarEvents(fetcher, undefined);

    expect(fetcher).toHaveBeenCalledWith("UTC");
  });

  it("accepts valid IANA timezone", async () => {
    const fetcher = mockFetcher({ events: [] });

    await handleGetCalendarEvents(fetcher, "Asia/Tokyo");

    expect(fetcher).toHaveBeenCalledWith("Asia/Tokyo");
  });
});
