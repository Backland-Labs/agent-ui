# Structured Logging

**Date:** 2026-02-13
**Status:** Ready for planning

## What We're Building

Structured, queryable logging across all server-side boundaries using Pino. The goal is fast production debugging and clear local development output with zero noise from low-level internals.

## Why This Approach

The codebase currently has zero observability -- no logging library, no request tracing, and several code paths that silently swallow errors. Boundary-oriented structured logging gives the most debugging value per line of code: every external call (DB, upstream HTTP, agent endpoints) and every request lifecycle event gets a canonical log entry with high-cardinality fields for filtering.

## Design Principles

Drawn from the team's preferences and loggingsucks.com:

1. **Log for queryability, not prose** -- structured `event` + fields, not human sentences.
2. **Canonical request-completion events** -- one rich "wide" event per request with all context.
3. **High-cardinality correlation keys** -- `requestId`, `runId`, `threadId`, `agentId` on every relevant log line.
4. **Boundary logging only** -- API routes, external HTTP calls, DB errors, state transitions. No logging in pure helpers, render paths, or SSE token deltas.
5. **Hard security guardrail** -- never log chat message content, OAuth tokens, or secret-bearing headers.

## Key Decisions

### Library: Pino

- Fast JSON-native logger, standard in Node.js.
- `pino-pretty` as dev transport for human-readable output.
- JSON output in production (Railway reads stdout).

### Architecture: Approach A+ (explicit instrumentation + route wrapper)

1. **`src/lib/server/logger.ts`** -- shared Pino instance. JSON in prod, pino-pretty in dev. Configured via `LOG_LEVEL` env var (defaults: `info` in prod, `debug` in dev).
2. **`withRouteLogging(handler)`** -- thin wrapper for Next.js route handlers. Generates `requestId`, creates a child logger with route context, logs canonical `request.start` and `request.end` events (with duration, status), catches unhandled errors and logs `request.error`.
3. **Explicit business logging inside handlers** -- gateway lifecycle events, run state transitions, upstream call outcomes. These use the child logger from the wrapper.
4. **Child loggers per context** -- gateway handler creates a child with `{ runId, threadId, agentId }`. Calendar creates a child with `{ service: "google-calendar", accountLabel }`.

### Coverage Targets

| Layer                           | What gets logged                                              | Level           |
| ------------------------------- | ------------------------------------------------------------- | --------------- |
| All API routes                  | request.start, request.end, request.error                     | info/error      |
| Gateway stream                  | started, upstream_connected, run_status_changed, stream_ended | info            |
| External HTTP (agent, calendar) | call start, response status, timeout, error                   | info/warn/error |
| DB operations                   | errors only (not every query)                                 | error           |
| Run state transitions           | pending, running, completed, failed, cancelled                | info            |
| Silent error paths              | Fix existing swallowed errors to log at warn/error            | warn/error      |

### What We Do NOT Log

- Chat message content (privacy)
- OAuth tokens, refresh tokens, secret headers (security)
- SSE token deltas / streaming chunks (noise/cost)
- Pure helper function internals
- React component renders or client-side events
- Every DB query (only errors)

### Environment Config

| Variable    | Default                       | Purpose                              |
| ----------- | ----------------------------- | ------------------------------------ |
| `LOG_LEVEL` | `info` (prod) / `debug` (dev) | Pino log level                       |
| `NODE_ENV`  | --                            | Controls pretty-print vs JSON output |

## Open Questions

- Should we add a `requestId` response header so clients can reference it in bug reports? (Low effort, likely yes.)
- Future consideration: OpenTelemetry as transport layer when volume/cost becomes relevant. Not needed now.

## Next Steps

Run `/workflows:plan` to create the implementation plan.
