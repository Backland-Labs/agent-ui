---
title: "feat: Cache /api/narrative results in UI proxy"
type: feature
date: 2026-02-18
detail_level: standard
status: completed
issue: https://github.com/Backland-Labs/agent-ui/issues/13
---

# feat: Cache /api/narrative results in UI proxy

## Overview

Add short-lived server-side caching to `GET /api/narrative` so repeated landing-page requests within a 60 second window can return normalized narrative data without re-calling the email-agent upstream endpoint, while preserving existing error behavior and response shape. Cache bypass via `refresh=1` is a behavior flag, not an authorization boundary.

## Problem Statement / Motivation

The landing UI calls `/api/narrative` on initial mount and on manual refresh. Today the proxy always performs upstream work, which increases latency and repeated load for quick reload/navigation patterns. We need a deterministic, testable cache that improves responsiveness while keeping user-facing behavior stable.

## Detailed Background

- Current route implementation (`src/app/api/narrative/route.ts`) always calls upstream `POST /narrative` after resolving `email-agent` endpoint configuration.
- The route already normalizes payload shape and maps errors (`404` source unavailable, `502` upstream non-ok, `500` request failure), and emits structured logs for start/completion/failure.
- Client refresh behavior lives in `src/lib/hooks/useNarrative.ts`; refresh currently calls the same URL as initial load and does not signal cache bypass intent.
- Existing in-memory cache precedent in repo is `src/lib/server/google-calendar.ts`, using module-scoped cache with `60_000` ms TTL.
- Existing narrative tests cover parsing/mapping/error cases but not cache semantics.

## Stakeholders

- End users loading the landing narrative card (faster repeated loads).
- Engineers maintaining `src/app/api/narrative/route.ts` and `src/lib/hooks/useNarrative.ts`.
- Observability owners who need cache hit/miss/bypass visibility in structured logs.

## Acceptance Criteria

- [ ] Repeated non-refresh requests within TTL return cached `200` data and do not call upstream again.
- [ ] TTL boundary is deterministic: cache hit when `ageMs < 60000`; cache miss when `ageMs >= 60000`.
- [ ] First non-refresh request after TTL expiry refetches upstream and rewrites cache on success.
- [ ] Manual refresh uses explicit bypass signal (`refresh=1`) and forces upstream fetch even when cache is valid.
- [ ] Bypass parsing is strict: only `refresh=1` bypasses cache; all other/missing values do not.
- [ ] Refresh bypass rewrites cache only on successful `200` response; failed refresh does not overwrite existing cached success.
- [ ] Cache write eligibility is explicit: write only after upstream `200` and successful normalization path; non-200/network failures are never cached.
- [ ] Route keeps current single-attempt fetch behavior (no new timeout/retry policy changes in this issue).
- [ ] Expired cache is not served; on expired-entry + upstream failure, route returns existing mapped error contract.
- [ ] Existing response contract remains unchanged: `items`, `narrative`, `actionItems`; existing error mapping remains unchanged.
- [ ] Cache key is endpoint-aware to avoid cross-endpoint contamination if endpoint identity changes.
- [ ] Route emits structured cache observability events for `hit`, `miss`, and `bypass` with route-consistent event naming and fields: `requestId`, `cacheKey`, `cacheAgeMs` (when applicable), `bypass`, `source`, `upstreamStatus` (when applicable), and `durationMs`.
- [ ] Tests cover hit/miss/expiry, refresh bypass, strict bypass parsing, non-caching of errors, endpoint-aware key isolation, and refresh signaling from the hook.

## Proposed Solution

1. Extend narrative route caching behavior in `src/app/api/narrative/route.ts`:
   - Introduce module-scoped in-memory cache entry for successful normalized `LandingNarrativeResponse` payload.
   - Use a 60 second TTL (`60_000` ms) matching existing repository cache style.
   - Evaluate cache before upstream fetch for standard requests.
   - Skip cache read when refresh bypass is requested.
   - Cache only successful response payloads after normalization; do not cache failures.

2. Add refresh-bypass request signal from hook in `src/lib/hooks/useNarrative.ts`:
   - Keep initial load request as `/api/narrative`.
   - Send refresh requests as `/api/narrative?refresh=1`.
   - Preserve existing UI state behavior (overlay refresh error for non-404 refresh failures, terminal error on 404 refresh failures).

3. Keep route wrapper thin and explicit:
   - Update `GET` route export to accept `NextRequest`, parse `refresh` query, and pass bypass intent to `handleGetNarrative(...)` helper.
   - Keep DB sync and error mapping behavior unchanged.

4. Add cache observability logs in route:
   - `narrative.cache_hit`
   - `narrative.cache_miss`
   - `narrative.cache_bypass`
   - Include fields like `cacheAgeMs` (when applicable) and `durationMs` consistent with existing route logging style.

5. Define cache correctness semantics up front:
   - Keep expired cache entries non-servable; always attempt upstream after expiry.
   - On expiry + upstream failure, return mapped error response and do not treat stale cache as fallback output in this issue.
   - Use endpoint-aware cache keying based on resolved upstream endpoint identity.
   - Keep refresh bypass parsing strict (`refresh=1` only).

## Technical Considerations

- Cache scope is process-local in-memory state; behavior is best-effort in multi-instance/serverless deployments.
- Cache keying must include resolved endpoint identity to avoid cross-endpoint contamination.
- Keep route and helper testability: preserve `handleGetNarrative(...)` as primary business-logic seam.
- Add deterministic time control in tests (fake timers or injected `now` provider) to validate TTL boundaries without flakiness.
- Prevent test cross-contamination from module-scoped cache by explicit cache reset strategy between tests.
- Bypass parsing is strict: only `refresh=1` activates cache bypass.
- Keep observability payloads low-cardinality and avoid logging narrative content/items.
- Concurrency note: in-flight request deduplication is out of scope for this issue; plan focuses on TTL cache semantics and bypass correctness.

## Research Note (Phase 3 Consolidation)

- Key references and file paths:
  - `src/app/api/narrative/route.ts`
  - `src/lib/hooks/useNarrative.ts`
  - `src/app/api/narrative/__tests__/route.test.ts`
  - `src/lib/hooks/__tests__/useNarrative.test.ts`
  - `src/lib/server/google-calendar.ts`
  - `src/lib/server/__tests__/google-calendar.test.ts`
  - `src/app/api/calendar/__tests__/route.test.ts`
- Reusable learnings from `docs/solutions/`:
  - `docs/solutions/integration-issues/pino-transport-bun-incompatibility-system-20260213.md` reinforces keeping logging runtime-safe and structured, with minimal request-path overhead.
- External research decision:
  - Skipped. Domain is low-risk and local code patterns are strong and directly reusable.
- Open questions:
  - None blocking for issue scope.

## Dependencies and Risks

- Dependency on configured `email-agent` endpoint in DB and upstream `/narrative` availability.
- Risk of stale reads within TTL window; accepted tradeoff for reduced repeated upstream calls.
- Risk of cache inconsistency across multiple server instances; mitigated by documenting process-local semantics.
- Risk of brittle tests due to shared cache state; mitigated by explicit reset/time control.

## Success Metrics

- Narrative route tests verify one upstream call for repeated non-refresh requests within TTL.
- Narrative route tests verify refetch occurs at/after expiry threshold and cache updates.
- Narrative route tests verify strict bypass parsing and endpoint-aware cache-key isolation.
- Hook tests verify refresh request uses bypass query parameter.
- Existing response-shape and error-mapping tests remain green after cache changes.
- Logging paths emit expected cache lifecycle events during hit/miss/bypass scenarios with required diagnostic fields and no payload content.

## Implementation Plan

- [x] Task 1: Add cache primitives and bypass-aware handler flow in `src/app/api/narrative/route.ts`.
  - Add TTL constant and cache entry type for normalized narrative response.
  - Add helper logic for reading valid cache, writing successful cache, and bypass checks.
  - Keep `handleGetNarrative(...)` as route-logic seam with optional bypass/time injection for testing.

- [x] Task 2: Wire route wrapper query parsing and hook refresh signaling.
  - Update `GET` in `src/app/api/narrative/route.ts` to parse `refresh=1` and pass bypass flag.
  - Update `fetchNarrative("refresh")` in `src/lib/hooks/useNarrative.ts` to call `/api/narrative?refresh=1`.

- [x] Task 3: Expand route tests for cache behavior in `src/app/api/narrative/__tests__/route.test.ts`.
  - Add tests for cache miss -> write -> hit.
  - Add tests for deterministic expiry boundary (`ageMs < 60000` hit, `>= 60000` miss) and refetch.
  - Add tests for bypass behavior (`refresh=1`) and strict parsing (non-`1` values do not bypass).
  - Add tests for non-overwrite on bypass failure and expired-cache + upstream-failure behavior.
  - Add tests ensuring errors are not cached, endpoint-aware key isolation, and existing error mapping remains unchanged.

- [x] Task 4: Expand hook tests in `src/lib/hooks/__tests__/useNarrative.test.ts`.
  - Assert initial mount uses `/api/narrative`.
  - Assert manual refresh uses `/api/narrative?refresh=1`.
  - Keep existing refresh state/error semantics covered.

- [x] Task 5: Validation run.
  - `bun run test src/app/api/narrative/__tests__/route.test.ts`
  - `bun run test src/lib/hooks/__tests__/useNarrative.test.ts`
  - `bun run typecheck`
  - `bun run lint`
  - Note: repo-wide `bun run lint` currently fails because generated files under `.worktrees/**/.next/**` are included; changed narrative files pass targeted `eslint`.

## References

- Issue: `https://github.com/Backland-Labs/agent-ui/issues/13`
- Route implementation: `src/app/api/narrative/route.ts`
- Hook implementation: `src/lib/hooks/useNarrative.ts`
- Narrative route tests: `src/app/api/narrative/__tests__/route.test.ts`
- Narrative hook tests: `src/lib/hooks/__tests__/useNarrative.test.ts`
- Existing cache pattern: `src/lib/server/google-calendar.ts`
- Existing cache tests: `src/lib/server/__tests__/google-calendar.test.ts`
- Route wrapper test pattern: `src/app/api/calendar/__tests__/route.test.ts`
- AGENTS guidance: `AGENTS.md`
