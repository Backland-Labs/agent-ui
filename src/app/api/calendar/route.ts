import { NextRequest, NextResponse } from "next/server";
import { fetchTodayEvents as defaultFetchTodayEvents } from "@/lib/server/google-calendar";
import type { CalendarResponse } from "@/types/calendar.types";

type Fetcher = (timezone: string) => Promise<CalendarResponse>;

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function handleGetCalendarEvents(
  fetcher: Fetcher = defaultFetchTodayEvents,
  timezone?: string
): Promise<NextResponse> {
  const tz = timezone && isValidTimezone(timezone) ? timezone : "UTC";
  const response = await fetcher(tz);
  const allFailed = response.errors.length > 0 && response.events.length === 0;

  return NextResponse.json(response, { status: allFailed ? 502 : 200 });
}

export async function GET(req: NextRequest) {
  const timezone = req.nextUrl.searchParams.get("tz") ?? undefined;
  return handleGetCalendarEvents(defaultFetchTodayEvents, timezone);
}
