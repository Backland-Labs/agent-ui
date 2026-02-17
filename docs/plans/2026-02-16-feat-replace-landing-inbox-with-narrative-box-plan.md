---
title: "feat: Replace landing inbox with email narrative box"
type: feature
date: 2026-02-16
detail_level: standard
status: completed
brainstorm: docs/brainstorms/2026-02-14-main-landing-ui-brainstorm.md
---

# feat: Replace landing inbox with email narrative box

## Overview

Replace the main landing page inbox preview module with an email narrative box backed by the email-agent `/narrative` endpoint (via app route proxy), while preserving the existing daily digest and calendar modules.

## Problem Statement / Motivation

The current landing experience is intended for fast daily triage, but the inbox preview list emphasizes raw thread browsing over concise narrative context. We want the primary landing module to surface narrative results from the email-agent so users can understand recent email activity faster, then jump into full inbox workflows only when needed.

## Detailed Background

- Brainstorm context already exists in `docs/brainstorms/2026-02-14-main-landing-ui-brainstorm.md` and confirms the landing page should optimize time-to-triage.
- Existing landing structure composes digest, calendar, and a left-dominant inbox-style card in `src/components/landing/LandingContent.tsx`.
- Existing repository patterns already include an API boundary for narrative data in `src/app/api/narrative/route.ts` and a client hook in `src/lib/hooks/useNarrative.ts`.
- This plan focuses on finishing and hardening that replacement so behavior is deterministic, testable, and aligned with landing UX goals.

## Stakeholders

- End users triaging daily email and agent activity from `/`.
- Product/UX owners of the landing page information hierarchy.
- Engineering owners of landing UI modules and API integration boundaries.

## Acceptance Criteria

- [x] Landing left/main module shows narrative items sourced from `/api/narrative` (email-agent `/narrative` proxy), not the prior inbox-preview data source.
- [x] Landing narrative module has explicit base states: `initial_loading`, `success`, `empty`, `terminal_error`, plus optional `refresh_error_overlay` that can coexist with `success` or `empty`.
- [x] Empty state (`200` with no items) renders the copy `All caught up.` + `No recent items to triage from the email agent.` and does not render error-copy banners.
- [x] Source-unavailable state is triggered only for `/api/narrative` `404` responses and renders `Email narrative source unavailable`.
- [x] Error copy is mapped by failure class: unavailable source shows `Email narrative source unavailable`; upstream/network/parse failures show `Unable to load email narrative`.
- [x] Narrative items render in deterministic descending recency order by `lastActivityAt`; rendering is capped to a fixed preview limit (7).
- [x] Malformed upstream rows are ignored without failing the full module when at least one valid row exists.
- [x] If all upstream rows are malformed but endpoint returns `200`, UI resolves to empty state (not error state).
- [x] Refresh supports repeated clicks safely: for overlapping requests A then B, if A resolves after B, UI keeps B's data (A is ignored).
- [x] If refresh fails after prior success, the last successful rows remain visible with an inline error indicator and retry action.
- [x] "Open full inbox" CTA remains available from the narrative module for deeper workflows.
- [x] All rendered narrative rows navigate to `/thread/[id]`; rows with invalid/missing IDs are excluded from payload and never rendered as links.
- [x] Digest and calendar modules remain unchanged in behavior and placement.
- [x] Landing layout remains correct at 375x812 (mobile) and 1280x800 (desktop): narrative section heading appears before digest heading; digest heading appears before calendar heading; at desktop digest and calendar are grouped in the right column container.
- [x] Unit/component/API tests explicitly assert success, empty, source-unavailable (`404`), upstream failure (`502`/`500`), parse failure, malformed payload filtering, refresh race ordering, and refresh-failure-after-success behavior.

## Proposed Solution

Use the existing landing architecture and complete the narrative-backed module as the primary left card.

1. Keep `src/components/landing/LandingContent.tsx` as the composition layer, wiring the narrative hook into the left module.
2. Use `src/app/api/narrative/route.ts` as the contract boundary between UI and email-agent endpoint.
3. Normalize and sanitize narrative records in the route handler before returning typed payloads.
4. Use `src/lib/hooks/useNarrative.ts` to own fetch lifecycle, loading/error state, abort handling, and refresh behavior.
5. Render narrative rows and state variants in `src/components/landing/AgentInboxPreview.tsx` while preserving link-out to `/inbox`.

## Technical Considerations

- **Contract resilience:** `/narrative` payload may vary (`items`, `data`, or raw array); mapping should remain tolerant but strict on required identifiers.
- **State correctness:** explicitly prevent stale updates from in-flight requests by using abort controller + request identity checks.
- **Error taxonomy:** keep user-facing copy concise; distinguish unavailable source (`404` from proxy) from transient upstream failures (`502`/`500`).
- **Deterministic output:** enforce sorting and preview cap at API boundary to keep UI consistent.
- **Non-regression:** do not alter digest/calendar APIs or sidebar navigation behavior.

### Error-to-UX Mapping

- `404` from `/api/narrative` -> show `Email narrative source unavailable`.
- `401`, `403`, `429`, `502`, `500`, network failure, timeout, or JSON parse failure -> show `Unable to load email narrative`.
- Any other non-`2xx` response -> show `Unable to load email narrative`.
- `200` with `items: []` (or all rows dropped during normalization) -> show empty state copy, not error copy.

### Data Normalization Contract

- Required field: `threadId` from aliases `threadId`, `thread_id`, `id`, `thread`. If missing/blank, drop row.
- Optional fields and defaults:
  - `agentName` -> default `Email Agent`.
  - `title` -> default `Untitled narrative`.
  - `snippet` -> default `No messages yet` and truncate to snippet limit.
  - `lastMessageRole` -> only `user|assistant|system`, else `null`.
- `lastActivityAt` parsing:
  - Accept ISO string or epoch number.
  - If invalid/missing, set to `1970-01-01T00:00:00.000Z` (sorts to oldest).
- Sorting/limit:
  - Sort by `lastActivityAt` descending; tie-break by `threadId` ascending.
  - Apply preview limit after sorting (max 7).

### State Transition Matrix

- **Initial load:** show loading skeleton; on success show rows/empty; on failure show error state.
- **Manual refresh (from success):** keep existing rows visible while refresh is in-flight and show refresh-in-progress affordance.
- **Manual refresh success:** replace rows with latest normalized payload and clear inline error.
- **Manual refresh failure:** keep prior rows and show inline error + retry affordance.
- **Rapid refresh clicks:** latest request wins; stale responses are ignored.
- **Operational rule:** each request gets a monotonic `requestId`; only active `requestId` may write state. Prior request is aborted when a new one starts.
- **Unmount/navigation:** abort active request and block post-unmount state updates.

### Research Note (Phase 3 Consolidation)

- **Key references and paths**
  - `docs/brainstorms/2026-02-14-main-landing-ui-brainstorm.md`
  - `src/components/landing/LandingContent.tsx`
  - `src/components/landing/AgentInboxPreview.tsx`
  - `src/app/api/narrative/route.ts`
  - `src/lib/hooks/useNarrative.ts`
  - `src/components/landing/__tests__/LandingContent.test.tsx`
  - `src/components/landing/__tests__/landing-components.test.tsx`
  - `src/app/api/narrative/__tests__/route.test.ts`
- **Reusable learnings from `docs/solutions/`**
  - Keep integration boundaries explicit and runtime-safe under Bun; avoid brittle assumptions at integration points (`docs/solutions/integration-issues/pino-transport-bun-incompatibility-system-20260213.md`).
- **External research decision**
  - Skipped: low-risk, internal endpoint integration with strong local patterns.
- **Open questions**
  - None blocking. This plan standardizes preview limit (7) and keeps manual refresh (mount + user-triggered refresh).

## Dependencies and Risks

- Dependency on `email-agent` availability and correctness of its `/narrative` payload.
- Risk of schema drift in upstream response keys; mitigated by tolerant mapping + tests for malformed rows.
- Risk of UX confusion if empty and error states are visually similar; mitigated via explicit copy and state-specific UI.
- Risk of race conditions during repeated refresh; mitigated via abort + latest-request-wins policy.

## Success Metrics

- Narrative module renders successfully under expected payload shapes with no runtime errors in local/CI tests.
- All defined acceptance tests pass for API route and landing components.
- No regressions in digest/calendar rendering on landing page test suite.
- Manual verification confirms users can triage from narrative and still navigate to `/inbox` and `/thread/[id]`.

## Implementation Plan

- [x] **Task 1: Confirm and lock narrative API contract**
  - Validate mapping/sanitization behavior in `src/app/api/narrative/route.ts`.
  - Ensure deterministic output (recency sort + max 7 items) before response.
  - Keep status behavior explicit: unavailable source is `404`; all other failures (`401`/`403`/`429`/`5xx`/timeout/parse) map to retryable generic failure copy.
  - Define all-malformed-input behavior as `200` with `items: []`.

- [x] **Task 2: Finalize narrative client state handling**
  - Implement/confirm `requestId` + abort strategy in `src/lib/hooks/useNarrative.ts` for latest-request-wins semantics.
  - Implement/confirm state transitions for initial load, refresh success, refresh failure after prior success, and retry.
  - Ensure unmount abort behavior prevents stale setState calls.
  - Keep API contract typing aligned with `src/types/landing.types.ts` and `src/types/index.ts`.

- [x] **Task 3: Replace/validate landing primary module behavior**
  - Ensure `src/components/landing/LandingContent.tsx` left module is narrative-driven.
  - Ensure `src/components/landing/AgentInboxPreview.tsx` implements distinct loading/empty/error/success UI.
  - Keep row navigation contract strict: only valid `threadId` items are rendered as links to `/thread/[id]`.
  - Keep `/inbox` CTA visible for workflow continuity.

- [x] **Task 4: Test coverage and regression checks**
  - Update/confirm API tests in `src/app/api/narrative/__tests__/route.test.ts` for success, malformed rows, all-malformed-to-empty behavior, unavailable source, upstream non-ok, and parse failures.
  - Update/confirm hook tests in `src/lib/hooks/__tests__/useNarrative.test.ts` for refresh concurrency, refresh failure after prior success, and abort/unmount behavior.
  - Update/confirm landing component tests in `src/components/landing/__tests__/LandingContent.test.tsx` and `src/components/landing/__tests__/landing-components.test.tsx`.
  - Verify digest/calendar non-regression in landing composition tests, including desktop/mobile layout invariants.

- [x] **Task 5: Validation commands**
  - Run `bun run test src/app/api/narrative/__tests__/route.test.ts`.
  - Run `bun run test src/lib/hooks/__tests__/useNarrative.test.ts`.
  - Run `bun run test src/components/landing/__tests__/LandingContent.test.tsx src/components/landing/__tests__/landing-components.test.tsx`.
  - Run `bun run typecheck` and `bun run lint`.

## References

- Brainstorm: `docs/brainstorms/2026-02-14-main-landing-ui-brainstorm.md`
- Related plan baseline: `docs/plans/2026-02-14-feat-main-landing-ui-plan.md`
- Landing route shell: `src/app/page.tsx`
- Landing composition: `src/components/landing/LandingContent.tsx`
- Narrative module UI: `src/components/landing/AgentInboxPreview.tsx`
- Narrative API route: `src/app/api/narrative/route.ts`
- Narrative hook: `src/lib/hooks/useNarrative.ts`
- Landing types: `src/types/landing.types.ts`
- Solution learning (Bun integration reliability): `docs/solutions/integration-issues/pino-transport-bun-incompatibility-system-20260213.md`
