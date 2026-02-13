---
title: "Add CI, Unit Tests with Coverage, and Pre-commit Enforcement"
type: feat
date: 2026-02-12
---

# Add CI, Unit Tests with Coverage, and Pre-commit Enforcement

## Overview

The agent-ready audit identified three weak areas: no test coverage beyond a single Playwright e2e file, no CI pipeline, and no automated formatting or pre-commit enforcement. This plan addresses all three to close the feedback loops that prevent agents (and humans) from introducing regressions undetected.

## Problem Statement

- **No unit tests.** The only tests are Playwright e2e tests that verify page loads. An agent modifying `src/lib/agents/config.ts` or `src/app/api/mock-agent/route.ts` has no way to verify correctness.
- **No CI.** Lint failures, type errors, and test regressions are only caught if someone remembers to run checks manually.
- **No formatting or pre-commit hooks.** Code style drifts across commits. Nothing stops broken code from being committed.

## Proposed Solution

Three workstreams, each independently valuable:

1. **Vitest + unit tests + coverage** -- Add Vitest with jsdom environment, write tests for `src/lib/` and API routes, enforce coverage thresholds.
2. **GitHub Actions CI** -- Run type-check, lint, and unit tests on every push and PR.
3. **Prettier + Husky + lint-staged** -- Auto-format on commit, run lint + type-check as pre-commit gate.

## Technical Considerations

- **Vitest vs Jest**: Vitest is the natural choice -- native ESM, fast, understands Vite/TS path aliases via `vite-tsconfig-paths`, and works well with Bun.
- **Path alias**: `@/*` -> `./src/*` must be replicated in `vitest.config.ts` using the `vite-tsconfig-paths` plugin.
- **`"use client"` directives**: Hooks in `src/lib/hooks/` use this directive. Vitest with jsdom handles it, but Supabase calls need mocking.
- **Playwright coexistence**: Playwright uses `tests/*.spec.ts`. Vitest should use `src/**/*.test.ts` to avoid overlap.
- **ESLint flat config**: Already uses ESLint 9 flat config. Prettier integration uses `eslint-config-prettier` as a flat config entry.
- **Existing code style**: Double quotes, semicolons, 2-space indent, trailing commas in multi-line. Prettier config should match to avoid a reformatting diff.
- **Stale `yarn.lock`**: An untracked `yarn.lock` exists. Should be deleted or gitignored since the project uses Bun.
- **CI env vars**: `next build` needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. CI should provide dummy values since we're not running e2e tests.

## Acceptance Criteria

### Vitest + Unit Tests

- [ ] Vitest installed and configured in `vitest.config.ts`
- [ ] `bun run test` runs unit tests, `bun run test:coverage` generates coverage report
- [ ] Tests for `src/lib/agents/config.ts` -- `loadAgentsConfig()`, `getAgentById()`, `getAgentIds()`
- [ ] Tests for `src/lib/utils.ts` -- `cn()` function
- [ ] Tests for `src/app/api/mock-agent/route.ts` -- `getMockResponse()`, SSE event formatting, POST handler
- [ ] Coverage thresholds enforced (start at current level, ratchet up over time)

### GitHub Actions CI

- [ ] `.github/workflows/ci.yml` runs on push and pull_request
- [ ] CI steps: install deps, type-check (`tsc --noEmit`), lint (`eslint`), unit tests (`vitest run`)
- [ ] CI uses `oven-sh/setup-bun` action and `bun install --frozen-lockfile`
- [ ] Build step with dummy Supabase env vars to catch build errors

### Prettier + Pre-commit Hooks

- [ ] Prettier installed and configured (`.prettierrc`, `.prettierignore`)
- [ ] `eslint-config-prettier` added to ESLint flat config to disable conflicting rules
- [ ] Husky installed with `.husky/pre-commit` hook
- [ ] lint-staged runs Prettier + ESLint on staged files before commit
- [ ] `bun run format` script added to package.json
- [ ] Existing code formatted with Prettier in a dedicated commit (no functional changes mixed in)

### package.json Scripts

- [ ] `"test": "vitest run"` -- run unit tests
- [ ] `"test:watch": "vitest"` -- watch mode
- [ ] `"test:coverage": "vitest run --coverage"` -- with coverage
- [ ] `"typecheck": "tsc --noEmit"` -- type checking
- [ ] `"format": "prettier --write ."` -- format all files
- [ ] `"format:check": "prettier --check ."` -- check formatting (for CI)

## Implementation Notes

### Vitest Config (`vitest.config.ts`)

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/app/api/**"],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

### Prettier Config (`.prettierrc`)

Matches existing code style to avoid a massive diff:

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### CI Workflow (`.github/workflows/ci.yml`)

```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun run lint
      - run: bun run format:check
      - run: bun run test:coverage
    env:
      NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
      NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy-key-for-ci
```

### lint-staged Config (in `package.json`)

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["prettier --write", "eslint --fix"],
    "*.{json,md,css,mjs}": ["prettier --write"]
  }
}
```

### Test File Locations

```
src/lib/agents/__tests__/config.test.ts
src/lib/__tests__/utils.test.ts
src/app/api/mock-agent/__tests__/route.test.ts
```

### Implementation Order

1. **Prettier + format existing code** -- Do this first in its own commit so the formatting diff is isolated.
2. **Vitest + unit tests** -- Install, configure, write tests.
3. **Husky + lint-staged** -- Wire up pre-commit hooks.
4. **CI workflow** -- Add GitHub Actions last, once all scripts are working locally.

### CLAUDE.md Updates

Add to the Commands section:

```bash
# Tests (unit)
bun run test                # Run unit tests
bun run test:watch          # Run in watch mode
bun run test:coverage       # Run with coverage report

# Formatting
bun run format              # Format all files
bun run format:check        # Check formatting (CI)
bun run typecheck           # Type-check without emitting
```

## Dependencies & Risks

- **Prettier reformatting**: The initial format commit will touch many files. Should be done as a standalone commit with no functional changes to keep git blame useful (`git blame --ignore-rev`).
- **Coverage thresholds**: Starting at 80% for the targeted directories (`src/lib/`, `src/app/api/`). Ratchet up as tests are added. Don't block CI on overall project coverage yet since components aren't unit-tested.
- **Bun compatibility**: Vitest and Husky work with Bun. `bun install --frozen-lockfile` is the CI install command. Husky init should use `bunx husky init`.

## References

- Existing ESLint config: `eslint.config.mjs`
- Existing TS config: `tsconfig.json` (strict mode, path aliases)
- Existing Playwright config: `playwright.config.ts` (e2e in `tests/` dir)
- Agent config loader: `src/lib/agents/config.ts:1-19`
- Mock agent route: `src/app/api/mock-agent/route.ts:1-141`
- Project conventions: `CLAUDE.md`
