# Google Calendar Integration -- Brainstorm

**Date:** 2026-02-13
**Status:** Ready for planning

## What We're Building

A read-only sidebar widget that displays today's agenda from two separate Google/Gmail accounts in a unified, chronological list. Events are color-coded or labeled by account. The widget lives in the existing `AgentSidebar` component alongside the Inbox and Agents navigation.

This is a single-user personal tool -- no multi-user auth is needed.

## Why This Approach

**Server-side API route + client polling:**

- A Next.js API route (`/api/calendar`) fetches today's events from both Google Calendar accounts using the `googleapis` library with stored OAuth refresh tokens
- The server merges and sorts events from both accounts, returning a unified JSON array
- A `CalendarWidget` component in the sidebar polls this endpoint on a reasonable interval (e.g., every 5 minutes) and renders today's agenda
- OAuth refresh tokens are stored as environment variables (simple for single-user, keeps secrets server-side)

**Why not client-side?** The codebase follows a server-first pattern (API routes that clients call). Keeping Google credentials server-side is simpler and more secure.

## Key Decisions

- **Read-only** -- no event creation or editing from the UI. Users manage events in Google Calendar directly.
- **Two Google accounts** -- OAuth refresh tokens for each stored as env vars (e.g., `GOOGLE_CALENDAR_TOKEN_1`, `GOOGLE_CALENDAR_TOKEN_2`). A one-time setup script or manual OAuth flow produces these tokens.
- **Today's agenda only** -- chronological list of today's events, not a full calendar grid.
- **Sidebar widget** -- compact view inside the existing sidebar, not a dedicated page/route.
- **Server-side fetching** -- `/api/calendar` route handles all Google API communication.
- **Polling for freshness** -- client polls every ~5 minutes. Calendar data is low-frequency enough that this is fine.
- **No agent integration** -- this is purely a UI feature, not connected to the agent/chat system.

## Open Questions

- What Google Cloud project / OAuth client ID will be used? Need to set up a GCP project with the Calendar API enabled and create OAuth 2.0 credentials.
- Exact env var naming and format for storing refresh tokens for each account.
- How to differentiate the two accounts visually (color, label, icon?).
- Should the widget show all-day events differently from timed events?
- What to display when there are no events today.

## Scope

### In scope

- `/api/calendar` route that fetches and merges events from two Google accounts
- `CalendarWidget` sidebar component showing today's agenda
- Account differentiation (color-coding or labels)
- Env-var-based token storage
- One-time OAuth setup script or instructions

### Out of scope

- Event creation, editing, or deletion
- Multi-user support or in-app OAuth flow
- Full calendar page with month/week/day views
- Agent access to calendar data
- Real-time updates (polling is sufficient)
