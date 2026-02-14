---
module: System
date: 2026-02-13
problem_type: integration_issue
component: tooling
symptoms:
  - "Pino transport option fails with Bun: unable to determine transport target for pino-pretty"
  - "Worker thread module resolution fails when Bun runs Pino with transport config"
root_cause: config_error
resolution_type: config_change
severity: medium
tags: [pino, bun, transport, pino-pretty, worker-threads, logging, next-js]
---

# Troubleshooting: Pino Transport Target Resolution Fails with Bun Runtime

## Problem

Pino's `transport` option (which spawns a worker thread via `thread-stream`) cannot resolve transport targets like `pino-pretty` when running under Bun. This blocks dev-mode pretty-printing of structured logs.

## Environment

- Module: System (logging infrastructure)
- Next.js Version: 16.1.6
- Pino Version: 10.x
- Runtime: Bun (package manager and script runner)
- Affected Component: `src/lib/server/logger.ts` configuration
- Date: 2026-02-13

## Symptoms

- Pino's `transport: { target: "pino-pretty" }` option throws at runtime when Bun is the script runner
- Error message: `error: unable to determine transport target for "pino-pretty"`
- The error occurs because Bun's worker thread implementation cannot resolve the `pino-pretty` module path the way Node.js does via `thread-stream`

## What Didn't Work

**Attempted Solution 1:** Using Pino's built-in `transport` option for dev pretty-printing

```typescript
// logger.ts - BROKEN with Bun
const transport =
  process.env.NODE_ENV !== "production"
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined;

export const logger = pino({ level, transport });
```

- **Why it failed:** Pino's `transport` option uses `thread-stream` to spawn a worker thread that dynamically resolves the target module. Bun's module resolution in worker threads does not support this pattern. This is a confirmed open bug: [oven-sh/bun#23062](https://github.com/oven-sh/bun/issues/23062).

**Attempted Solution 2:** Using pino-pretty as a synchronous stream (no worker thread)

```typescript
import pinoPretty from "pino-pretty";
const stream = pinoPretty({ colorize: true });
export const logger = pino({ level }, stream);
```

- **Why it failed:** While this avoids the worker thread, it blocks the main thread during formatting and introduces a direct import of `pino-pretty` that would need conditional handling for production builds.

## Solution

Use pipe-based pretty-printing in the `package.json` dev script instead of Pino's transport option. The logger module writes raw JSON to stdout in all environments, and `pino-pretty` processes it externally via a shell pipe.

**Code changes:**

```typescript
// src/lib/server/logger.ts - WORKING
import pino from "pino";

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug");

export const logger = pino({
  level,
  serializers: { err: pino.stdSerializers.err },
  redact: {
    paths: [
      "password",
      "secret",
      "token",
      "refreshToken",
      "refresh_token",
      "authorization",
      "cookie",
      "*.password",
      "*.secret",
      "*.token",
      "*.refreshToken",
      "*.refresh_token",
      "*.authorization",
      "*.cookie",
    ],
    censor: "[REDACTED]",
  },
});
```

```json
// package.json - dev script pipes through pino-pretty
{
  "scripts": {
    "dev": "next dev --turbopack | bunx pino-pretty"
  }
}
```

**Key points:**

- No `transport` option at all -- Pino writes JSON to stdout synchronously (its fastest path)
- `pino-pretty` runs as a separate process via pipe, completely avoiding Bun's worker thread bug
- Non-JSON lines from Next.js (compilation messages, "Ready on localhost:3000") pass through pino-pretty unchanged
- In production on Railway, raw JSON goes to stdout with no pipe -- Railway parses it natively

## Why This Works

1. **Root cause**: Bun's worker thread implementation has a module resolution bug that prevents it from finding Pino transport targets. The `thread-stream` library that Pino uses internally calls `require()` inside a worker thread, and Bun does not resolve the module path correctly in that context.

2. **Why pipe works**: By piping stdout through `bunx pino-pretty`, the pretty-printing happens in a completely separate process. Bun acts only as the script runner for `next dev`, while `pino-pretty` runs in its own process with its own module resolution. The two processes communicate via stdin/stdout, bypassing the worker thread mechanism entirely.

3. **Why this is actually the Pino-recommended approach**: The Pino maintainers recommend piping through `pino-pretty` in production for the same reason -- it decouples formatting from the application process, ensuring zero overhead on the main thread. Using it in dev too is simpler and more consistent.

## Prevention

- When using Pino with Bun, always prefer pipe-based pretty-printing over Pino's `transport` option
- Check [oven-sh/bun#23062](https://github.com/oven-sh/bun/issues/23062) for status -- if resolved, the `transport` option may work in future Bun versions
- When adding new Node.js libraries that use worker threads, test them under Bun's runtime specifically -- Bun's worker thread support has known gaps
- Document Bun compatibility constraints in CLAUDE.md when discovered

## Related Issues

No related issues documented yet.
