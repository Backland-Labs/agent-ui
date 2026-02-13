---
title: "feat: Add structured logging with Pino"
type: feat
date: 2026-02-13
brainstorm: docs/brainstorms/2026-02-13-structured-logging-brainstorm.md
deepened: 2026-02-13
---

# feat: Add Structured Logging with Pino

## Enhancement Summary

**Deepened on:** 2026-02-13
**Research agents used:** TypeScript reviewer, Performance oracle, Security sentinel, Architecture strategist, Code simplicity reviewer, Pattern recognition specialist, Agent-native reviewer, Best practices researcher, Framework docs researcher, Repo research analyst

### Key Improvements

1. Fixed event naming to use consistent dotted-namespace convention across all log sites
2. Identified bare `catch {}` blocks that need `catch (error)` to bind the error for logging
3. Discovered Bun + pino-pretty transport compatibility issue -- use pipe-based dev logging instead
4. Added explicit `err` serializer configuration for reliable stack trace capture
5. Removed unused `type Logger` export (YAGNI)
6. Clarified exact placement of `gateway.stream_ended` log inside ReadableStream callback

### New Considerations Discovered

- Bun has an open bug with pino-pretty transport worker resolution -- fallback to `bun dev | bunx pino-pretty` pipe
- Next.js 16.1.6 auto-externalizes `pino`, `pino-pretty`, `thread-stream` via built-in `serverExternalPackages` -- no config needed
- HMR in dev spawns new pino-pretty worker threads that accumulate -- piping avoids this entirely
- Railway reads single-line JSON from stdout and supports `@field:value` filtering

## Overview

Add boundary-oriented structured logging to the server-side code using Pino. Logging is added directly where it matters: the gateway handler (complex streaming, external calls, multiple failure modes), the Google Calendar module (external HTTP), and the root layout (silent error swallowing). CRUD routes are left alone.

## Problem Statement / Motivation

The codebase has zero server-side observability. The gateway handler -- the most complex and failure-prone code path -- has no logging at all. Several code paths silently swallow errors (root layout DB failure, health check fetch). When something breaks in production on Railway, there is no diagnostic output to work with.

## Proposed Solution

Two layers:

1. **Logger module** (`src/lib/server/logger.ts`) -- shared Pino instance with environment-aware config (JSON in prod, plain JSON in dev for pipe-based pretty-printing).
2. **Inline logging** -- added directly inside `handleGatewayPost`, `google-calendar.ts`, and the root layout catch block. No wrapper abstraction. No changes to CRUD route handlers.

## Technical Approach

### New File

#### `src/lib/server/logger.ts`

```typescript
import pino from "pino";

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug");

export const logger = pino({
  level,
  serializers: { err: pino.stdSerializers.err },
});
```

#### Research Insights

**Bun + pino-pretty transport issue:** Bun has an open bug where `pino-pretty` cannot be resolved as a Pino transport target (worker thread resolution fails). Instead of configuring `transport` in the logger module, use pipe-based pretty-printing in dev:

```bash
# In package.json scripts:
"dev": "next dev --turbopack | bunx pino-pretty"
```

This also avoids HMR worker thread accumulation (each HMR reload would spawn a new pino-pretty worker thread that never gets cleaned up).

**Explicit serializer:** Configure `serializers: { err: pino.stdSerializers.err }` explicitly rather than relying on Pino's implicit detection. This guarantees `message`, `type`, `stack`, and `code` are always extracted from Error objects.

**No `type Logger` export:** The original plan exported `type Logger = pino.Logger`. Nothing in the plan uses it. Drop it (YAGNI).

**Railway compatibility:** Pino's default JSON output (one JSON object per line on stdout) is exactly what Railway expects. Railway supports `@field:value` filtering, so structured fields like `runId`, `event`, `service` are directly queryable.

### Modified Files

#### `src/app/api/gateway/route.ts` -- `handleGatewayPost`

Import `logger` directly at the top of the module. Do NOT change the `handleGatewayPost` function signature -- it stays `(req: Request, db: Db)`.

Create a child logger inside the function once `runId`, `threadId`, and `agentId` are available:

```typescript
const log = logger.child({ runId, threadId, agentId });
```

Add 4 lifecycle events at the boundaries:

| Event                         | When                                                              | Fields              | Level |
| ----------------------------- | ----------------------------------------------------------------- | ------------------- | ----- |
| `gateway.started`             | After creating the run record                                     | `{ agentEndpoint }` | info  |
| `gateway.stream_ended`        | After stream while-loop completes inside `ReadableStream.start()` | `{ durationMs }`    | info  |
| `gateway.request_failed`      | On fetch error, timeout, non-200, stream read error               | `{ code, err }`     | error |
| `gateway.client_disconnected` | On AbortSignal abort (client disconnect)                          | `{}`                | warn  |

Key implementation notes:

- Use Pino's `err` serializer key for errors to preserve stack traces: `log.error({ event: "gateway.request_failed", code, err: error }, "agent fetch failed")`
- Track stream start time separately from handler start time so `durationMs` on `gateway.stream_ended` measures actual stream duration, not just setup.
- The `gateway.stream_ended` log MUST go inside the `ReadableStream.start()` callback, after the `while (true)` loop breaks and before `controller.close()`. This is the only place that has access to the correct timing and knows the stream completed successfully.
- Do NOT log the `messages` array from the request body (contains chat content).
- Do NOT log request/response headers (may contain secrets from upstream agent calls).
- Do NOT log inside the `while (true)` streaming loop (SSE token deltas are noise/cost).

#### Research Insights (Gateway)

**Event naming:** The original plan used `gateway.error` which breaks the past-tense verb convention used by all other events (`started`, `stream_ended`, `client_disconnected`). Renamed to `gateway.request_failed` for consistency.

**Stream timing placement:** The performance review confirmed that `gateway.stream_ended` must be placed inside the `ReadableStream.start()` callback (after the while-loop at line 349, before `controller.close()` at line 365). Placing it after `new Response(stream, ...)` would fire immediately since ReadableStream is lazy.

**Catch block binding:** The existing `catch {}` at line 358 in the stream reader needs to become `catch (error)` to bind the error for logging.

#### `src/lib/server/google-calendar.ts`

Create a module-level child logger. Replace the two existing `console` calls:

```typescript
import { logger } from "./logger";
const log = logger.child({ service: "google-calendar" });
```

```typescript
// Replace console.warn (line 44) with:
log.warn({ event: "calendar.token_refreshed", accountLabel: account.label });

// Replace console.error (line 151) with:
log.error({ event: "calendar.fetch_failed", accountLabel: clients[i].label, err: result.reason });
```

#### `src/app/layout.tsx` -- Root Layout

Add one line to the existing catch block that silently swallows `syncAgentsToDb()` failure.

**Important:** The current catch block is bare `catch {` (line 57). It must become `catch (error) {` to bind the error variable for logging.

```typescript
import { logger } from "@/lib/server/logger";
// Change: catch {  -->  catch (error) {
logger.warn({ event: "layout.agent_sync_failed", err: error });
```

#### `src/app/api/agents/[id]/health/route.ts` -- Health Check

Add a debug-level log to the catch block that currently swallows fetch errors silently.

**Important:** The current catch block is bare `catch {` (line 38). It must become `catch (error) {` to bind the error variable for logging.

```typescript
import { logger } from "@/lib/server/logger";
// Change: catch {  -->  catch (error) {
logger.debug({ event: "health.check_failed", agentId, err: error });
```

Use `debug` level because health check failures are expected/normal for offline agents.

#### Research Insights (Event Naming)

**Consistent dotted namespace:** All events now use `<module>.<past_tense_verb>` convention:

| Module     | Events                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------- |
| `gateway`  | `gateway.started`, `gateway.stream_ended`, `gateway.request_failed`, `gateway.client_disconnected` |
| `calendar` | `calendar.token_refreshed`, `calendar.fetch_failed`                                                |
| `layout`   | `layout.agent_sync_failed`                                                                         |
| `health`   | `health.check_failed`                                                                              |

The original plan had `agent_sync_failed` and `health_check_failed` (flat naming without module prefix). These are now normalized to dotted namespace for consistent filtering.

### Environment Config

Add to `.env.example`:

```
# Logging
# LOG_LEVEL=debug    # Options: trace, debug, info, warn, error, fatal (default: info in prod, debug in dev)
```

Update `package.json` dev script for pipe-based pretty-printing:

```json
"dev": "next dev --turbopack | bunx pino-pretty"
```

### Dependencies

```bash
bun add pino
bun add -d pino-pretty
```

### What We Do NOT Change

- **CRUD route handlers** (agents, threads, threads/[id], threads/[id]/messages) -- these are trivial one-query handlers. When they fail, the error bubbles up as a 500 visible in Railway's HTTP logs. Adding logging wrappers to them is ceremony without diagnostic value.
- **`handleGatewayPost` function signature** -- import the logger directly, don't thread it as a parameter. This avoids coupling the handler interface to the logging infrastructure and keeps existing tests untouched.
- **mock-agent route** -- test endpoint, not production code.
- **`next.config.ts`** -- Next.js 16.1.6 already includes `pino`, `pino-pretty`, and `thread-stream` in its built-in `serverExternalPackages` list. No configuration needed.

### What We Do NOT Log

- Chat message content (privacy)
- OAuth tokens, refresh tokens, secret-bearing headers (security)
- SSE token deltas / streaming chunks (noise/cost)
- Every DB query (only errors that surface)
- Run state transitions (already persisted in the `runs` table and queryable via SQL)

## Acceptance Criteria

- [ ] `pino` and `pino-pretty` installed as runtime and dev dependencies respectively
- [ ] `src/lib/server/logger.ts` exports a configured Pino instance; JSON output in all environments (no transport config)
- [ ] `LOG_LEVEL` env var controls log level; defaults to `info` in prod, `debug` in dev
- [ ] `package.json` dev script pipes through `pino-pretty` for human-readable dev output
- [ ] Logger configures `serializers: { err: pino.stdSerializers.err }` explicitly
- [ ] Gateway handler logs 4 lifecycle events: `gateway.started`, `gateway.stream_ended`, `gateway.request_failed`, `gateway.client_disconnected`
- [ ] Gateway error logs include stack traces via Pino's `err` serializer
- [ ] Gateway `stream_ended` event includes accurate stream duration (placed inside ReadableStream.start callback)
- [ ] Google Calendar module uses structured Pino logging instead of console.warn/error
- [ ] Root layout catch block binds error variable and logs at warn level (no longer silent)
- [ ] Health check catch block binds error variable and logs at debug level (no longer fully silent)
- [ ] All events use consistent `module.past_tense_verb` naming convention
- [ ] No chat message content, OAuth tokens, or secret-bearing headers appear in any log output
- [ ] Existing unit tests pass without modification (no handleX signature changes)
- [ ] `.env.example` updated with `LOG_LEVEL` documentation

## Success Metrics

- Production errors that were previously invisible now appear in Railway logs
- A developer can filter logs by `runId` to see the full lifecycle of an agent interaction
- Gateway failures (timeouts, unreachable agents, stream errors) are immediately diagnosable from log output

## Dependencies & Risks

**Dependencies:**

- `pino` (npm) -- stable, widely used, no known issues with Next.js server-side
- `pino-pretty` (npm, dev only) -- used via pipe (`| bunx pino-pretty`), not via Pino's `transport` option

**Risks:**

- **Bun + pino-pretty transport bug**: Bun cannot resolve `pino-pretty` as a Pino transport target (worker thread resolution issue). Mitigated by using pipe-based pretty-printing (`bun dev | bunx pino-pretty`) instead of the `transport` option.
- **Root layout build-time import**: `layout.tsx` runs during `next build`. The logger module has no dev-only transport configuration, so it works identically in build and runtime contexts.
- **Next.js serverExternalPackages**: Next.js 16.1.6 already includes `pino`, `pino-pretty`, and `thread-stream` in its default `serverExternalPackages` list. No manual configuration needed, but worth knowing for future Next.js upgrades.

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-02-13-structured-logging-brainstorm.md`
- Gateway route (primary target): `src/app/api/gateway/route.ts`
- Google Calendar (console replacement): `src/lib/server/google-calendar.ts`
- Root layout (silent error): `src/app/layout.tsx`
- Health check (silent error): `src/app/api/agents/[id]/health/route.ts`

### External References

- Pino docs: https://getpino.io
- pino-pretty: https://github.com/pinojs/pino-pretty
- Design principles: https://loggingsucks.com
