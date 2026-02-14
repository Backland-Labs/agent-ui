import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockWarn = vi.fn();
const mockError = vi.fn();
const mockChildLogger = {
  trace: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: mockWarn,
  error: mockError,
  fatal: vi.fn(),
  child: vi.fn(),
};
vi.mock("../logger", () => ({
  logger: {
    child: () => mockChildLogger,
  },
}));

interface MockOAuthClient {
  setCredentials: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
}

const oauthClients: Array<{
  setCredentials: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
}> = [];

const oauthClientMock = vi.fn(function (this: MockOAuthClient) {
  const client = {
    setCredentials: vi.fn(),
    on: vi.fn(),
  };
  oauthClients.push(client);
  Object.assign(this, client);
});

const eventsListMock = vi.fn();

const calendarClientFactoryMock = vi.fn(() => ({
  events: {
    list: eventsListMock,
  },
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: oauthClientMock,
}));

vi.mock("@googleapis/calendar", () => ({
  calendar: calendarClientFactoryMock,
}));

type CalendarEnvKey =
  | "GOOGLE_CLIENT_ID"
  | "GOOGLE_CLIENT_SECRET"
  | "GOOGLE_REFRESH_TOKEN_1"
  | "GOOGLE_REFRESH_TOKEN_2"
  | "GOOGLE_ACCOUNT_LABEL_1"
  | "GOOGLE_ACCOUNT_LABEL_2";

const CALENDAR_ENV_KEYS: CalendarEnvKey[] = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN_1",
  "GOOGLE_REFRESH_TOKEN_2",
  "GOOGLE_ACCOUNT_LABEL_1",
  "GOOGLE_ACCOUNT_LABEL_2",
];

const originalCalendarEnv = CALENDAR_ENV_KEYS.reduce<Record<CalendarEnvKey, string | undefined>>(
  (acc, key) => {
    acc[key] = process.env[key];
    return acc;
  },
  {} as Record<CalendarEnvKey, string | undefined>
);

const setCalendarEnv = (values: Partial<Record<CalendarEnvKey, string | undefined>>) => {
  for (const key of CALENDAR_ENV_KEYS) {
    const value = values[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

const loadGoogleCalendar = async () => {
  vi.resetModules();
  eventsListMock.mockReset();
  calendarClientFactoryMock.mockClear();
  oauthClientMock.mockClear();
  oauthClients.length = 0;
  mockWarn.mockClear();
  mockError.mockClear();

  return import("../google-calendar");
};

beforeEach(() => {
  setCalendarEnv({});
});

afterEach(() => {
  setCalendarEnv(originalCalendarEnv);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("google-calendar", () => {
  it("returns an unconfigured response when credentials are missing", async () => {
    const { fetchTodayEvents } = await loadGoogleCalendar();
    const response = await fetchTodayEvents("UTC");

    expect(response.isConfigured).toBe(false);
    expect(response.events).toHaveLength(0);
    expect(response.errors).toHaveLength(0);
    expect(calendarClientFactoryMock).toHaveBeenCalledTimes(0);
    expect(response.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("calls token handlers for refresh token events", async () => {
    setCalendarEnv({
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      GOOGLE_REFRESH_TOKEN_1: "refresh-token-1",
    });
    const { fetchTodayEvents } = await loadGoogleCalendar();

    eventsListMock.mockResolvedValue({ data: { items: [] } });

    await fetchTodayEvents("UTC");

    const tokenListener = oauthClients[0].on.mock.calls[0]?.[1];
    expect(tokenListener).toBeTypeOf("function");

    tokenListener?.({ refresh_token: undefined });
    tokenListener?.({ refresh_token: "temporary-token" });

    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "calendar.token_refreshed", accountLabel: "personal" }),
      expect.any(String)
    );
  });

  it("maps, filters, sorts, and returns events from multiple accounts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-13T12:00:00.000Z"));

    const randomUUIDSpy = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValue("fallback-event-id");
    setCalendarEnv({
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      GOOGLE_REFRESH_TOKEN_1: "refresh-token-1",
      GOOGLE_REFRESH_TOKEN_2: "refresh-token-2",
      GOOGLE_ACCOUNT_LABEL_1: "personal",
      GOOGLE_ACCOUNT_LABEL_2: "work",
    });

    const { fetchTodayEvents } = await loadGoogleCalendar();

    eventsListMock
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: "event-all-day",
              summary: "Sprint planning",
              status: "confirmed",
              start: { date: "2026-02-13" },
              end: { date: "2026-02-14" },
              htmlLink: "https://calendar.google.com/events/personal/1",
            },
            {
              id: "cancelled",
              status: "cancelled",
              summary: "Cancelled",
              htmlLink: "https://calendar.google.com/events/personal/2",
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              status: "confirmed",
              summary: "No title available",
              start: { date: "2026-02-13" },
              end: { date: "2026-02-13" },
              attendees: [{ self: true, responseStatus: "declined" }],
            },
            {
              summary: undefined,
              start: {},
              end: {},
              attendees: [{ self: true, responseStatus: "accepted" }],
              conferenceData: {
                entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/fallback" }],
              },
              htmlLink: "https://calendar.google.com/events/work/2",
            },
            {
              id: "event-work-later",
              summary: "Code review",
              start: { dateTime: "2026-02-13T10:00:00Z" },
              end: { dateTime: "2026-02-13T11:00:00Z" },
              attendees: [{ self: true, responseStatus: "accepted" }],
              conferenceData: {
                entryPoints: [{ entryPointType: "phone", uri: "https://calls.example.com/none" }],
              },
              htmlLink: "https://calendar.google.com/events/work/3",
            },
          ],
        },
      });

    const response = await fetchTodayEvents("UTC");

    expect(oauthClientMock).toHaveBeenCalledTimes(2);
    expect(calendarClientFactoryMock).toHaveBeenCalledTimes(2);
    const calls = calendarClientFactoryMock.mock.calls as Array<unknown[]>;
    expect(calls[0]?.[0]).toBeDefined();
    expect(calls[1]?.[0]).toBeDefined();
    expect((calls[0]![0] as { version: string }).version).toBe("v3");
    expect((calls[1]![0] as { version: string }).version).toBe("v3");
    expect(oauthClients[0].setCredentials).toHaveBeenCalledWith({
      refresh_token: "refresh-token-1",
    });
    expect(oauthClients[1].setCredentials).toHaveBeenCalledWith({
      refresh_token: "refresh-token-2",
    });
    expect(response.isConfigured).toBe(true);
    expect(response.errors).toEqual([]);
    expect(response.date).toBe("2026-02-13");
    expect(eventsListMock).toHaveBeenCalledTimes(2);
    expect(eventsListMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        calendarId: "primary",
        timeMin: "2026-02-13T00:00:00+00:00",
        timeMax: "2026-02-14T00:00:00+00:00",
        timeZone: "UTC",
        singleEvents: true,
        orderBy: "startTime",
      })
    );

    expect(response.events).toEqual([
      {
        id: "event-all-day",
        title: "Sprint planning",
        startTime: null,
        endTime: null,
        isAllDay: true,
        account: "personal",
        htmlLink: "https://calendar.google.com/events/personal/1",
        meetLink: null,
      },
      {
        id: "fallback-event-id",
        title: "(No title)",
        startTime: null,
        endTime: null,
        isAllDay: false,
        account: "work",
        htmlLink: "https://calendar.google.com/events/work/2",
        meetLink: "https://meet.google.com/fallback",
      },
      {
        id: "event-work-later",
        title: "Code review",
        startTime: "2026-02-13T10:00:00Z",
        endTime: "2026-02-13T11:00:00Z",
        isAllDay: false,
        account: "work",
        htmlLink: "https://calendar.google.com/events/work/3",
        meetLink: null,
      },
    ]);

    randomUUIDSpy.mockRestore();
  });

  it("reuses cache for subsequent calls within TTL", async () => {
    setCalendarEnv({
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      GOOGLE_REFRESH_TOKEN_1: "refresh-token-1",
    });

    const { fetchTodayEvents } = await loadGoogleCalendar();

    eventsListMock.mockResolvedValue({
      data: {
        items: [
          {
            id: "cached-event",
            summary: "Cached event",
            start: { dateTime: "2026-02-13T10:00:00Z" },
            end: { dateTime: "2026-02-13T11:00:00Z" },
            htmlLink: "https://calendar.google.com/events/1",
          },
        ],
      },
    });

    const first = await fetchTodayEvents("UTC");
    const second = await fetchTodayEvents("UTC");

    expect(first.fetchedAt).toBe(second.fetchedAt);
    expect(eventsListMock).toHaveBeenCalledTimes(1);
    expect(second.events).toHaveLength(1);
  });

  it("collects per-account errors when a client fails", async () => {
    setCalendarEnv({
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      GOOGLE_REFRESH_TOKEN_1: "refresh-token-1",
      GOOGLE_REFRESH_TOKEN_2: "refresh-token-2",
    });

    const { fetchTodayEvents } = await loadGoogleCalendar();

    eventsListMock
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: "ok-event",
              summary: "Team check-in",
              start: { dateTime: "2026-02-13T09:00:00Z" },
              end: { dateTime: "2026-02-13T09:30:00Z" },
              htmlLink: "https://calendar.google.com/events/ok",
            },
          ],
        },
      })
      .mockRejectedValueOnce(new Error("google down"));

    const response = await fetchTodayEvents("UTC");

    expect(response.events).toHaveLength(1);
    expect(response.events[0].id).toBe("ok-event");
    expect(response.errors).toEqual([{ account: "work", message: "Failed to fetch events" }]);
    expect(response.isConfigured).toBe(true);
    expect(mockError).toHaveBeenCalledTimes(1);
    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({ event: "calendar.fetch_failed", accountLabel: "work" }),
      expect.any(String)
    );
  });

  it("treats missing calendar items as an empty list", async () => {
    setCalendarEnv({
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      GOOGLE_REFRESH_TOKEN_1: "refresh-token-1",
    });

    const { fetchTodayEvents } = await loadGoogleCalendar();

    eventsListMock.mockResolvedValueOnce({ data: {} });

    const response = await fetchTodayEvents("UTC");

    expect(response.events).toHaveLength(0);
    expect(response.errors).toHaveLength(0);
  });

  it("falls back to empty string when an event has no htmlLink", async () => {
    setCalendarEnv({
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      GOOGLE_REFRESH_TOKEN_1: "refresh-token-1",
    });

    const { fetchTodayEvents } = await loadGoogleCalendar();

    eventsListMock.mockResolvedValueOnce({
      data: {
        items: [
          {
            summary: "No link event",
            start: { dateTime: "2026-02-13T09:00:00Z" },
            end: { dateTime: "2026-02-13T10:00:00Z" },
          },
        ],
      },
    });

    const response = await fetchTodayEvents("UTC");

    expect(response.events).toHaveLength(1);
    expect(response.events[0].htmlLink).toBe("");
  });

  it("sorts timed events by startTime when no all-day/timed grouping is needed", async () => {
    setCalendarEnv({
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      GOOGLE_REFRESH_TOKEN_1: "refresh-token-1",
    });

    const { fetchTodayEvents } = await loadGoogleCalendar();

    eventsListMock.mockResolvedValueOnce({
      data: {
        items: [
          {
            summary: "Late event",
            start: { dateTime: "2026-02-13T10:00:00Z" },
            end: { dateTime: "2026-02-13T11:00:00Z" },
            htmlLink: "https://calendar.google.com/events/late",
          },
          {
            summary: "Early event",
            start: { dateTime: "2026-02-13T09:00:00Z" },
            end: { dateTime: "2026-02-13T10:00:00Z" },
            htmlLink: "https://calendar.google.com/events/early",
          },
        ],
      },
    });

    const response = await fetchTodayEvents("UTC");

    expect(response.events).toHaveLength(2);
    expect(response.events[0].title).toBe("Early event");
    expect(response.events[0].startTime).toBe("2026-02-13T09:00:00Z");
    expect(response.events[1].title).toBe("Late event");
    expect(response.events[1].startTime).toBe("2026-02-13T10:00:00Z");
  });

  it("sorts all-day events before timed events", async () => {
    setCalendarEnv({
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      GOOGLE_REFRESH_TOKEN_1: "refresh-token-1",
    });

    const { fetchTodayEvents } = await loadGoogleCalendar();

    eventsListMock.mockResolvedValueOnce({
      data: {
        items: [
          {
            summary: "Morning meeting",
            start: { dateTime: "2026-02-13T09:00:00Z" },
            end: { dateTime: "2026-02-13T10:00:00Z" },
            htmlLink: "https://calendar.google.com/events/timed",
          },
          {
            summary: "Company retreat",
            start: { date: "2026-02-13" },
            end: { date: "2026-02-14" },
            htmlLink: "https://calendar.google.com/events/all-day",
          },
        ],
      },
    });

    const response = await fetchTodayEvents("UTC");

    expect(response.events[0].title).toBe("Company retreat");
    expect(response.events[0].isAllDay).toBe(true);
    expect(response.events[1].title).toBe("Morning meeting");
    expect(response.events[1].isAllDay).toBe(false);
  });
});
