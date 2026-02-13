export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string | null; // ISO datetime for timed events, null for all-day
  endTime: string | null;
  isAllDay: boolean;
  account: string; // label from env var (e.g., "personal", "work")
  htmlLink: string; // link to open in Google Calendar
  meetLink: string | null; // Google Meet or conference link
}

export interface AccountError {
  account: string;
  message: string;
}

export interface CalendarResponse {
  events: CalendarEvent[];
  errors: AccountError[];
  fetchedAt: string; // ISO timestamp
  date: string; // YYYY-MM-DD
  isConfigured: boolean; // false when env vars not set
}
