---
title: "feat: Main landing daily command center"
type: feat
date: 2026-02-14
brainstorm: docs/brainstorms/2026-02-14-main-landing-ui-brainstorm.md
deepened: 2026-02-14
---

# feat: Main landing daily command center

## Enhancement Summary

**Deepened on:** 2026-02-14
**Research agents used:** Workflow synthesis (no external specialist agents)

### Key Improvements

1. Replace `/` redirect with a dedicated landing page that supports daily triage before thread-level work
2. Add a digest-first layout while keeping the inbox module visually dominant for action
3. Reuse existing calendar data flow (`/api/calendar`) for prominent agenda visibility on landing
4. Introduce a concise daily digest API derived from existing threads/messages data
5. Preserve existing `/inbox` and `/thread/[id]` behavior so landing is additive, not disruptive

## Overview

Build a new landing page at `/` that combines three areas in one glanceable view:

- Daily email-agent digest (summary of recent activity and urgent items)
- Prominent calendar agenda access
- Agent inbox preview that feels like familiar email triage

The page should prioritize speed-to-triage and quick routing into existing inbox/thread flows.

## Problem Statement / Motivation

The current root route immediately redirects to `/inbox`, which forces users to infer what changed by scanning individual threads. There is no high-signal daily overview. Users need a command-center entry point that surfaces what changed, what needs attention now, and where to click next.

## Proposed Solution

Create a dedicated server-rendered landing route with three composable panels and lightweight supporting APIs/hooks:

1. **Digest panel**: concise summary metrics and top items from last 24 hours
2. **Calendar panel**: expanded agenda module using existing `/api/calendar` endpoint
3. **Inbox panel**: thread preview list with clear unread/recent emphasis and CTA into full inbox

Keep deeper actions in existing routes (`/inbox`, `/thread/[id]`) to avoid duplicating full workflow logic.

## Technical Approach

### New Files

| File                                             | Purpose                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| `src/app/api/digest/route.ts`                    | Returns daily digest payload built from threads/messages/runs     |
| `src/components/landing/LandingContent.tsx`      | Main landing layout and module composition                        |
| `src/components/landing/DailyDigestCard.tsx`     | Digest summary UI with key metrics and action links               |
| `src/components/landing/LandingCalendarCard.tsx` | Landing-specific calendar presentation using `useCalendarEvents`  |
| `src/components/landing/AgentInboxPreview.tsx`   | Inbox-like preview list and quick links into thread/inbox         |
| `src/lib/hooks/useDailyDigest.ts`                | Client hook for digest fetch, loading/error handling, and refresh |
| `src/types/landing.types.ts`                     | Shared types for digest payload and landing modules               |

### Modified Files

| File                                      | Change                                                            |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `src/app/page.tsx`                        | Replace redirect with landing page scaffold                       |
| `src/components/sidebar/AgentSidebar.tsx` | Add/adjust nav affordance so landing is a first-class destination |
| `src/types/index.ts`                      | Re-export landing types                                           |

### Phase 1: Data Contract for Landing

Define explicit landing-specific types in `src/types/landing.types.ts`:

- `DailyDigest`
- `DigestMetric`
- `DigestItem`
- `LandingInboxThreadPreview`

Use a stable contract so UI modules are decoupled from raw DB row shape.

### Phase 2: Daily Digest API

Implement `GET /api/digest` in `src/app/api/digest/route.ts` using existing Drizzle patterns from `src/app/api/threads/route.ts`:

- Compute a 24-hour window (`since`)
- Return aggregate counts (new threads, active runs, agent replies)
- Return top digest items (most recently active threads with brief snippets)
- Include per-agent rollup for quick triage context
- Keep response compact and deterministic for fast first paint

Error behavior:

- Return `200` with empty arrays when no activity
- Return `500` with a sanitized error payload on query failures

### Phase 3: Landing UI Composition

Create `LandingContent` as a responsive two-column desktop layout and single-column mobile stack:

- Left/main (dominant): `AgentInboxPreview`
- Right/supporting: `DailyDigestCard` + `LandingCalendarCard`

UI behavior:

- Inbox preview resembles familiar email triage rows (sender/agent, subject/title, snippet, timestamp)
- Digest remains concise (3-6 bullet insights, not raw event feed)
- Calendar module prioritizes upcoming items and clear “open full calendar” action
- Empty states show “all caught up” language

### Phase 4: Root Route Migration

Update `src/app/page.tsx` to render landing content instead of `redirect("/inbox")`.

Implementation detail:

- Load agents config server-side (same source as inbox flow)
- Use Suspense boundaries where useful for progressive loading
- Preserve app shell/sidebar behavior unchanged

### Phase 5: Navigation and IA Updates

Update `AgentSidebar` so users can always return to the landing page quickly:

- Add a `Home` or `Today` nav item pointing to `/`
- Keep `/inbox` nav item for full thread list
- Ensure active-state styling works for both routes

### Phase 6: Tests

Add tests for new API and landing behaviors:

- `src/app/api/digest/__tests__/route.test.ts`
  - Returns deterministic shape with activity
  - Returns empty-but-valid payload with no activity
  - Handles DB failure with sanitized error response
- Component tests for landing cards and preview rendering states (loading, empty, error, success)

## Acceptance Criteria

- [ ] Visiting `/` shows a landing page (no immediate redirect)
- [ ] Landing page contains all three required modules: digest, calendar, and inbox preview
- [ ] Inbox preview is visually dominant and routes into existing inbox/thread pages
- [ ] Digest content is concise and oriented around daily triage, not raw logs
- [ ] Calendar area is prominent and useful on desktop and mobile
- [ ] Empty-day scenario displays clear “all caught up” messaging
- [ ] Existing `/inbox` and `/thread/[id]` workflows remain unchanged
- [ ] New digest API has automated tests for success/empty/error scenarios

## Dependencies & Risks

- Digest quality depends on available metadata in existing messages/runs tables; first version may need heuristic scoring
- Overloading landing with too much information can reduce triage speed; enforce concise digest limits
- Potential duplication between landing inbox preview and inbox list logic; keep preview intentionally lighter-weight

## References

### Internal

- Brainstorm: `docs/brainstorms/2026-02-14-main-landing-ui-brainstorm.md`
- Root route: `src/app/page.tsx`
- Inbox API baseline: `src/app/api/threads/route.ts`
- Inbox UI baseline: `src/components/inbox/InboxContent.tsx`
- Sidebar navigation baseline: `src/components/sidebar/AgentSidebar.tsx`
- Calendar baseline: `src/components/sidebar/CalendarWidget.tsx`
