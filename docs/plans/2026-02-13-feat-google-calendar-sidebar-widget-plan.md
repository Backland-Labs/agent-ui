---
title: Google Calendar Sidebar Widget
type: feat
date: 2026-02-13
deepened: 2026-02-13
---

# Google Calendar Sidebar Widget

## Enhancement Summary

**Deepened on:** 2026-02-13
**Research agents used:** best-practices-researcher, repo-research-analyst, kieran-typescript-reviewer, security-sentinel, performance-oracle, julik-frontend-races-reviewer, architecture-strategist, code-simplicity-reviewer, pattern-recognition-specialist, agent-native-reviewer, frontend-design

### Key Improvements

1. Switch from `googleapis` (~200MB) to `@googleapis/calendar` + `google-auth-library` (~7MB combined)
2. AbortController pattern in polling hook to prevent race conditions (6 race conditions identified and addressed)
3. Recursive `setTimeout` instead of `setInterval` to prevent interval stacking
4. Server-side in-memory cache with 60s TTL to reduce Google API calls
5. Graceful degradation when calendar env vars not configured (widget hidden)
6. Timezone validation with `Intl.DateTimeFormat` try/catch
7. Simplified UI states from 6 to 3 (loading, events/empty, error)
8. Handler function injection for testability (matching existing `handleGetThreads(db)` pattern)

## Overview

Add a read-only sidebar widget that displays today's agenda from two separate Google/Gmail accounts in a unified, chronological list. Events are color-coded by account. The widget lives inside the existing `AgentSidebar` as a new `SidebarGroup` below the agents list.

Single-user personal tool. No auth system needed. OAuth refresh tokens stored as env vars.

## Problem Statement / Motivation

The agent inbox UI is where the user spends their working day, but they currently have to context-switch to Google Calendar to check their schedule. A compact agenda widget in the sidebar eliminates this context switch and keeps the user's day visible at a glance.

## Proposed Solution

**Server-side API route + client polling.**

- `GET /api/calendar` fetches today's events from both Google accounts using `@googleapis/calendar` + `google-auth-library`, merges and sorts them, returns JSON
- `CalendarWidget` client component in the sidebar polls this endpoint every 5 minutes
- OAuth refresh tokens stored in env vars; a one-time setup script obtains them
- Separate `OAuth2Client` instance per Google account (same Client ID/Secret)
- When calendar env vars are not set, the widget does not render (graceful degradation)

## Technical Approach

### New Files

| File                                        | Purpose                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/lib/server/google-calendar.ts`         | Server-only module: creates per-account OAuth2 clients, exports `fetchTodayEvents()` |
| `src/types/calendar.types.ts`               | Shared TypeScript types for API response and events                                  |
| `src/app/api/calendar/route.ts`             | API route handler: calls `fetchTodayEvents()`, returns JSON                          |
| `src/components/sidebar/CalendarWidget.tsx` | Client component: polls `/api/calendar`, renders today's agenda                      |
| `src/lib/hooks/useCalendarEvents.ts`        | Hook: manages polling with AbortController, loading/error states                     |
| `scripts/get-google-token.ts`               | One-time script to obtain OAuth refresh tokens via local loopback flow               |

### Modified Files

| File                                      | Change                                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `src/components/sidebar/AgentSidebar.tsx` | Add `CalendarWidget` as a new `SidebarGroup` below agents                     |
| `.env.example`                            | Add Google Calendar env vars                                                  |
| `package.json`                            | Add `@googleapis/calendar`, `google-auth-library`, `server-only` dependencies |

### Phase 1: Google Calendar Server Module

**`src/lib/server/google-calendar.ts`**

- `import "server-only"` at the top to prevent client bundle inclusion
- Read env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN_1`, `GOOGLE_REFRESH_TOKEN_2`, `GOOGLE_ACCOUNT_LABEL_1`, `GOOGLE_ACCOUNT_LABEL_2`
- Validate env vars at module init: if `GOOGLE_CLIENT_ID` is not set, export `isConfigured = false` and make `fetchTodayEvents()` return empty results. This allows the widget to gracefully hide itself.
- Create two `OAuth2Client` instances (from `google-auth-library`) at module scope, each with `setCredentials({ refresh_token })`
- Listen to `tokens` event on each client to log warnings when Google rotates refresh tokens:
  ```typescript
  client.on("tokens", (tokens) => {
    if (tokens.refresh_token) {
      console.warn(`[calendar] Account "${label}" issued new refresh token. Update env var.`);
    }
  });
  ```
- Create two `calendar({ version: "v3", auth })` clients (from `@googleapis/calendar`)
- **In-memory cache** at module scope: store last response with a 60-second TTL to reduce Google API calls during rapid page navigations
  ```typescript
  let cache: { data: CalendarResponse; expires: number } | null = null;
  ```
- Export `fetchTodayEvents(timezone: string)`:
  - Check cache first; if valid, return cached data
  - Compute `timeMin` (start of today) and `timeMax` (end of today) using the provided IANA timezone
  - Call `events.list` on both clients in parallel via `Promise.allSettled`
  - Parameters: `calendarId: "primary"`, `singleEvents: true`, `orderBy: "startTime"`, `timeZone: timezone`, `maxResults: 50`
  - Filter out events where user's `responseStatus` is `"declined"` or `status` is `"cancelled"`
  - Map events to the `CalendarEvent` type, tagging each with its account label
  - Merge results from both accounts, sort chronologically (all-day events first, then by start time)
  - Store in cache with 60s TTL
  - Return `{ events, errors }` where `errors` captures any failed account fetches
- Export `isConfigured` boolean for the widget to check

### Phase 2: Types

**`src/types/calendar.types.ts`**

```typescript
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
```

Re-export from `src/types/index.ts` for consistency with existing barrel pattern.

### Phase 3: API Route

**`src/app/api/calendar/route.ts`**

- Follow existing handler extraction pattern from `src/app/api/threads/route.ts:9-66`: export `handleGetCalendarEvents(fetcher, timezone?)` + thin `GET()` wrapper
- The `fetcher` parameter defaults to the real `fetchTodayEvents` but can be replaced in tests (same pattern as `db` injection in `handleGetThreads`)
- Read `?tz=` query parameter (IANA timezone string, e.g., `America/New_York`)
- **Validate timezone**: wrap in `Intl.DateTimeFormat(undefined, { timeZone: tz })` try/catch; if invalid, default to `UTC`
- Default to `UTC` if not provided
- Call `fetcher(timezone)`
- Return `NextResponse.json(response)`
- **Sanitize error messages**: strip internal details from `errors[].message` before returning to client (e.g., replace Google API error details with generic "Failed to fetch events")
- Error handling: if both accounts fail, return 502. If at least one succeeds, return 200 with partial data + `errors` array. If not configured, return `{ events: [], errors: [], isConfigured: false }` with 200.

### Phase 4: Client Hook

**`src/lib/hooks/useCalendarEvents.ts`**

Follow existing pattern (`useState` + `useEffect` + `fetch`, no SWR -- consistent with codebase). Reference: `src/components/inbox/InboxContent.tsx:20-35` for the basic pattern, `src/lib/hooks/useAgentChat.ts:28` for AbortController pattern.

- State: `events`, `errors`, `loading`, `isConfigured`
- **AbortController**: store in `useRef<AbortController | null>(null)`. Abort previous fetch before starting new one. This prevents race conditions when multiple fetches are in flight.
- **Timezone**: compute once on mount with `useRef(Intl.DateTimeFormat().resolvedOptions().timeZone)`, not on every fetch
- On mount: fetch immediately, passing timezone as `?tz=` param
- **Polling with recursive `setTimeout`** (not `setInterval`): after each fetch completes, schedule next fetch in 5 minutes. This prevents interval stacking if a fetch takes longer than expected. Store timeout ID in `useRef`.
- **Page Visibility**: add `visibilitychange` listener. On hide: clear timeout. On show: fetch immediately if tab was hidden, then resume polling.
- **Manual refresh**: expose a `refresh()` function that aborts any in-flight fetch, fetches immediately, and resets the polling timer
- Cleanup on unmount: abort in-flight fetch, clear timeout, remove visibility listener
- Return: `{ events, errors, loading, isConfigured, refresh }`

### Phase 5: Sidebar Widget

**`src/components/sidebar/CalendarWidget.tsx`**

- Client component (`"use client"`)
- Uses `useCalendarEvents()` hook
- **Early return**: if `!isConfigured && !loading`, return `null` (widget hidden when calendar not set up)
- Wrapped in a `SidebarGroup` with `SidebarGroupLabel` showing "Today" (using existing `font-mono text-[10px] uppercase tracking-widest` style from `AgentSidebar.tsx:84`)
- Small refresh button in the group label row (Lucide `RefreshCw` icon, disabled while `loading`)
- When sidebar is collapsed (icon-only mode): widget is hidden entirely (use `group-data-[collapsible=icon]:hidden` class from existing sidebar patterns)

**Layout within 256px sidebar width:**

- **All-day events**: Rendered first as compact rows with colored left border + title (truncated)
- **Timed events**: Each row shows: colored left border (account indicator) + time (e.g., "2:00p") + title (truncated). Two-line layout: time on first line, title on second.
- **Current event highlight**: Events where `startTime <= now <= endTime` get a brighter left border and subtle background. Use a 60-second `setInterval` tick to update "now" for current-event detection (store tick in state, cleanup on unmount).
- **Now divider**: A thin horizontal line with "Now" label between past and upcoming events
- **Clickable**: Each event is an `<a>` linking to `htmlLink` (opens Google Calendar in new tab)
- **Meet link**: If `meetLink` exists, show a small video icon that links to it
- Max height of `320px` with `overflow-y-auto` for overflow

**States (simplified):**

| State             | Render                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| Loading (initial) | 3-4 skeleton rows with staggered `animationDelay` (match `InboxList.tsx:21-36` skeleton pattern) |
| Events exist      | Sorted event list with now divider                                                               |
| No events         | "No events today" centered text (muted)                                                          |
| Error             | "Couldn't load calendar" + retry button                                                          |

**Account colors (dark theme):**

- Account 1: `blue-400` left border
- Account 2: `emerald-400` left border
- Labels from env vars shown in tooltip on hover over the account border

### Phase 6: Sidebar Integration

**`src/components/sidebar/AgentSidebar.tsx`**

- Import `CalendarWidget`
- Add `<CalendarWidget />` inside `SidebarContent`, below the existing "Agents" group (after line 118)
- No new props needed on `AgentSidebar` -- the widget manages its own data fetching

### Phase 7: OAuth Setup Script

**`scripts/get-google-token.ts`**

- Standalone script runnable with `bun run scripts/get-google-token.ts`
- Reads `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from env (with clear error messages if missing)
- Starts a temporary HTTP server on `http://127.0.0.1:3001`
- Generates OAuth URL with `access_type: "offline"`, `prompt: "consent"`, scope `https://www.googleapis.com/auth/calendar.events.readonly`
- Opens browser automatically (use `open` package as dev dependency)
- Captures callback, exchanges code for tokens, prints refresh token to stdout
- Uses PKCE or `state` parameter for redirect validation
- User runs this once per account, copies the refresh token into `.env`

### Phase 8: Environment Variables

Add to `.env.example`:

```bash
# Google Calendar Integration (optional -- widget hidden when not configured)
# 1. Create OAuth credentials at https://console.cloud.google.com/apis/credentials
# 2. Enable Google Calendar API
# 3. Set OAuth consent screen to "In Production" (avoids 7-day token expiry)
# 4. Run: bun run scripts/get-google-token.ts (once per account)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN_1=
GOOGLE_REFRESH_TOKEN_2=
GOOGLE_ACCOUNT_LABEL_1=personal
GOOGLE_ACCOUNT_LABEL_2=work
```

### Phase 9: Tests

**`src/app/api/calendar/__tests__/route.test.ts`**

Follow existing test pattern from `src/app/api/threads/__tests__/route.test.ts`:

- Import and call `handleGetCalendarEvents(mockFetcher, timezone)` directly
- Mock `fetchTodayEvents` via the injected parameter (no module mocking needed)
- Test cases:
  - Returns events from both accounts merged and sorted
  - Returns 200 with partial data when one account fails
  - Returns 502 when both accounts fail
  - Validates timezone parameter (invalid falls back to UTC)
  - Returns `isConfigured: false` when not configured
  - Declined/cancelled events excluded (test the mock fetcher contract)

**`src/lib/hooks/__tests__/useCalendarEvents.test.ts`**

- Use `@testing-library/react-hooks` (already in devDependencies)
- Mock `fetch` with `vi.fn()`
- Test cases:
  - Fetches on mount with correct timezone parameter
  - Sets loading state correctly
  - Polls after 5 minutes (use `vi.useFakeTimers()`)
  - Aborts previous fetch on refresh
  - Handles fetch failure gracefully
  - Returns `isConfigured: false` from response

## Acceptance Criteria

- [ ] `/api/calendar?tz=America/New_York` returns today's events from both accounts, merged and sorted
- [ ] Partial failure: if one account fails, the other's events still return with a 200 status
- [ ] Declined and cancelled events are excluded
- [ ] All-day events render at the top, before timed events
- [ ] CalendarWidget appears in the sidebar below the agents list
- [ ] Widget polls every 5 minutes; pauses when tab is hidden
- [ ] Clicking an event opens it in Google Calendar in a new tab
- [ ] Widget shows loading skeletons on initial fetch
- [ ] Widget is hidden when sidebar is collapsed
- [ ] Widget is hidden when calendar env vars not configured
- [ ] Events are color-coded by account (blue / emerald left borders)
- [ ] Manual refresh button triggers immediate fetch
- [ ] Current/in-progress events have visual highlight
- [ ] Now divider appears between past and upcoming events
- [ ] Empty state shows "No events today"
- [ ] `scripts/get-google-token.ts` successfully obtains refresh tokens
- [ ] All Google credentials are server-only (no `NEXT_PUBLIC_` prefix, `server-only` import)
- [ ] Unit tests for API route with mocked fetcher
- [ ] Unit tests for `useCalendarEvents` hook

## Technical Considerations

**Package size:** Use `@googleapis/calendar` (~5MB) + `google-auth-library` (~2MB) instead of the full `googleapis` package (~200MB). The standalone calendar package provides the same API and is maintained by the same team. Import: `import { calendar } from "@googleapis/calendar"` and `import { OAuth2Client } from "google-auth-library"`.

**Timezone handling:** The client computes timezone once on mount with `Intl.DateTimeFormat().resolvedOptions().timeZone` and sends it as `?tz=` query parameter. The server validates it with a try/catch around `Intl.DateTimeFormat(undefined, { timeZone })`, falling back to UTC. The timezone is passed to Google Calendar API's `timeZone` parameter to ensure "today" boundaries match the user's local time.

**Server-side cache:** A module-scope in-memory cache with 60-second TTL prevents redundant Google API calls during rapid page navigations. The sidebar component persists across navigations (mounted in root `AppLayout`), so the cache primarily helps during initial page loads and hot module reloads in development.

**Token expiry:** If the Google Cloud OAuth consent screen is left in "Testing" mode, refresh tokens expire after 7 days. The setup instructions must emphasize setting the app to "In Production" status. For a personal tool with <100 users, no Google verification is needed.

**Race condition prevention:** The polling hook uses AbortController (matching the pattern in `useAgentChat.ts:28`) to cancel in-flight fetches before starting new ones. Recursive `setTimeout` (not `setInterval`) prevents interval stacking. The refresh button is disabled during loading to prevent concurrent clicks.

**Graceful degradation:** When `GOOGLE_CLIENT_ID` is not set, the server module exports `isConfigured = false`. The API route returns `{ events: [], isConfigured: false }`. The widget checks this and returns `null` (not rendered). No errors, no broken UI.

## Dependencies & Risks

- **Google Cloud project setup:** User must create a GCP project, enable Calendar API, and configure OAuth. This is a manual prerequisite.
- **Token rotation:** If Google rotates refresh tokens, the `tokens` event listener logs a warning. User must manually update env vars.
- **API quota:** 1M queries/day. Two accounts polled every 5 minutes = ~576 calls/day. No risk.
- **`server-only` package:** Must be added to `dependencies` (not devDependencies) to work correctly in Next.js builds.

## References & Research

### Internal References

- Sidebar structure: `src/components/sidebar/AgentSidebar.tsx`
- API route pattern (handler extraction + DI): `src/app/api/threads/route.ts:9-66`
- API route test pattern: `src/app/api/threads/__tests__/route.test.ts`
- Client fetch pattern: `src/components/inbox/InboxContent.tsx:20-35`
- AbortController pattern: `src/lib/hooks/useAgentChat.ts:28,76-77`
- Skeleton pattern: `src/components/inbox/InboxList.tsx:19-36`
- Types barrel: `src/types/index.ts`
- Brainstorm: `docs/brainstorms/2026-02-13-google-calendar-integration-brainstorm.md`

### External References

- [Google Calendar API v3 -- Events: list](https://developers.google.com/workspace/calendar/api/v3/reference/events/list)
- [@googleapis/calendar standalone package](https://www.npmjs.com/package/@googleapis/calendar)
- [google-auth-library](https://www.npmjs.com/package/google-auth-library)
- [Google OAuth 2.0 for server-side apps](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Loopback IP redirect flow](https://developers.google.com/identity/protocols/oauth2/resources/loopback-migration)
- [OAuth consent screen -- Testing vs Production](https://support.google.com/cloud/answer/15549945)
