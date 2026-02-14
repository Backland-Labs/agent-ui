import "server-only";

import { OAuth2Client } from "google-auth-library";
import { calendar as googleCalendar } from "@googleapis/calendar";
import type { CalendarEvent, AccountError, CalendarResponse } from "@/types/calendar.types";
import { logger } from "./logger";

const log = logger.child({ service: "google-calendar" });

// --- Configuration ---

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const accounts = [
  {
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN_1,
    label: process.env.GOOGLE_ACCOUNT_LABEL_1 || "personal",
  },
  {
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN_2,
    label: process.env.GOOGLE_ACCOUNT_LABEL_2 || "work",
  },
];

export const isConfigured = Boolean(
  clientId && clientSecret && accounts.some((a) => a.refreshToken)
);

// --- OAuth2 Clients ---

type AccountClient = {
  calendar: ReturnType<typeof googleCalendar>;
  label: string;
};

const clients: AccountClient[] = [];

if (isConfigured) {
  for (const account of accounts) {
    if (!account.refreshToken) continue;

    const auth = new OAuth2Client(clientId, clientSecret);
    auth.setCredentials({ refresh_token: account.refreshToken });

    auth.on("tokens", (tokens) => {
      if (tokens.refresh_token) {
        log.warn(
          { event: "calendar.token_refreshed", accountLabel: account.label },
          "new refresh token issued"
        );
      }
    });

    clients.push({
      calendar: googleCalendar({ version: "v3", auth }),
      label: account.label,
    });
  }
}

// --- In-memory Cache ---

let cache: { data: CalendarResponse; expires: number } | null = null;
const CACHE_TTL_MS = 60_000;

function normalizeOffset(offset: string | undefined): string {
  if (!offset) {
    return "+00:00";
  }

  const match = offset.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) {
    return "+00:00";
  }

  const sign = match[1];
  const hours = match[2].padStart(2, "0");
  const minutes = match[3] ?? "00";
  return `${sign}${hours}:${minutes}`;
}

function getTimeZoneOffset(date: Date, timezone: string): string {
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  return normalizeOffset(offset);
}

function getDateParts(date: Date, timezone: string): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: byType.year,
    month: byType.month,
    day: byType.day,
  };
}

// --- Core Fetch ---

async function fetchAccountEvents(
  client: AccountClient,
  timeMin: string,
  timeMax: string,
  timezone: string
): Promise<CalendarEvent[]> {
  const res = await client.calendar.events.list({
    calendarId: "primary",
    singleEvents: true,
    orderBy: "startTime",
    timeMin,
    timeMax,
    timeZone: timezone,
    maxResults: 50,
  });

  const items = res.data.items || [];

  return items
    .filter((event) => {
      if (event.status === "cancelled") return false;
      const selfAttendee = event.attendees?.find((a) => a.self);
      if (selfAttendee?.responseStatus === "declined") return false;
      return true;
    })
    .map((event): CalendarEvent => {
      const isAllDay = Boolean(event.start?.date);
      const meetLink =
        event.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === "video")?.uri ?? null;

      return {
        id: event.id || crypto.randomUUID(),
        title: event.summary || "(No title)",
        startTime: isAllDay ? null : (event.start?.dateTime ?? null),
        endTime: isAllDay ? null : (event.end?.dateTime ?? null),
        isAllDay,
        account: client.label,
        htmlLink: event.htmlLink || "",
        meetLink,
      };
    });
}

export async function fetchTodayEvents(timezone: string): Promise<CalendarResponse> {
  const now = Date.now();
  if (cache && cache.expires > now) {
    return cache.data;
  }

  if (!isConfigured || clients.length === 0) {
    return {
      events: [],
      errors: [],
      fetchedAt: new Date().toISOString(),
      date: new Date().toISOString().slice(0, 10),
      isConfigured: false,
    };
  }

  // Compute today's boundaries in the given timezone using RFC3339
  const nowDate = new Date();
  const { year, month, day } = getDateParts(nowDate, timezone);
  const todayStr = `${year}-${month}-${day}`; // YYYY-MM-DD
  const timeMin = `${todayStr}T00:00:00${getTimeZoneOffset(nowDate, timezone)}`;
  const tomorrow = new Date(`${todayStr}T00:00:00${getTimeZoneOffset(nowDate, timezone)}`);
  const tomorrowDate = new Date(tomorrow.getTime() + 86_400_000);
  const tomorrowParts = getDateParts(tomorrowDate, timezone);
  const timeMax = `${tomorrowParts.year}-${tomorrowParts.month}-${tomorrowParts.day}T00:00:00${getTimeZoneOffset(tomorrowDate, timezone)}`;

  const results = await Promise.allSettled(
    clients.map((client) => fetchAccountEvents(client, timeMin, timeMax, timezone))
  );

  const events: CalendarEvent[] = [];
  const errors: AccountError[] = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      events.push(...result.value);
    } else {
      errors.push({
        account: clients[i].label,
        message: "Failed to fetch events",
      });
      log.error(
        { event: "calendar.fetch_failed", accountLabel: clients[i].label, err: result.reason },
        "failed to fetch events"
      );
    }
  });

  // Sort: all-day events first, then by start time
  events.sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
    return 0;
  });

  const response: CalendarResponse = {
    events,
    errors,
    fetchedAt: new Date().toISOString(),
    date: todayStr,
    isConfigured: true,
  };

  cache = { data: response, expires: now + CACHE_TTL_MS };
  return response;
}
