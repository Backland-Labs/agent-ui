# AGENTS

Use this file as repo-specific operational guidance for coding agents working in this project.

## 1) Scope and purpose

- Primary stack: Next.js 16 (App Router), React 19, TypeScript 5, Bun.
- Persistence: libSQL/Turso via `@libsql/client` + `drizzle-orm`.
- Runtime surface: AG-UI protocol route (`/api/copilotkit`) and CopilotKit-backed UI.
- Testing stack: Vitest + Testing Library for unit, Playwright for e2e.

## 2) Commands to know

- `bun dev` starts the app on port 3000 using Next dev server + log pretty-printer.
- `bun run build` compiles production output.
- `bun run lint` runs ESLint checks.
- `bun run format` applies Prettier across the repo.
- `bun run format:check` verifies formatting (CI equivalent).
- `bun run typecheck` runs `tsc --noEmit`.
- `bun run test` runs all unit tests (`vitest run`).
- `bun run test:watch` runs unit tests in watch mode.
- `bun run test:coverage` runs tests and generates coverage artifacts.
- `bun run db:generate` regenerates Drizzle migration SQL metadata.
- `bun run db:migrate` runs local migration script.
- `bun run db:push` pushes schema to remote/database target.
- `bun run db:studio` opens Drizzle Studio.
- `bunx playwright test` runs Playwright suite.

### Helpful one-off test runs

- Single Vitest file: `bun run test src/lib/hooks/__tests__/useAgentChat.test.ts`.
- Single test name:
  `bun run test src/app/api/threads/__tests__/route.test.ts -t "creates a new thread"`.
- Single Playwright file: `bunx playwright test tests/app.spec.ts`.
- Single Playwright title:
  `bunx playwright test -g "login"`.

### CI expectations

- CI runs `bun run typecheck`, `bun run lint`, `bun run format:check`, `bun run build`, and `bun run test:coverage`.

## 3) Critical files and conventions to follow

- App routes are in `src/app/**/route.ts`.
- Shared UI is in `src/components/**`.
- Data and utilities are in `src/lib/**`.
- DB schema and client code in `db/**`.
- Agent definitions live in `agents.config.json`.
- Public-facing setup and scripts in `README.md` and `CLAUDE.md`.

## 4) Core coding conventions

- Use TypeScript strict style; keep explicit typing when behavior is non-trivial.
- Export only necessary symbols; prefer named exports unless module semantics require default.
- Prefer early returns for guard clauses and explicit error handling.
- Keep functions small and single-purpose; route handlers should be thin and delegate to helpers.
- Use `type` aliases for DB schema-driven structures when readability improves inference.
- Prefer `const` with clear object/array typing over `any`.
- Don’t use `console.log` for diagnostics; use logger utilities where available.
- Keep comments minimal and only for non-obvious intent.

## 5) API and route patterns

- Keep `route.ts` with explicit verb exports (`GET`, `POST`, etc.).
- Extract business logic into `handleXxx(...)` helpers that accept optional injected `db` values.
  - Existing pattern: `handleGetThreads(db = defaultDb, ...)`.
- Keep request parsing and validation inside route wrapper (`GET`, `POST`, etc.) or shared helper.
- Return `NextResponse.json(payload, { status })` for all API responses.
- Use explicit not-found/bad-input statuses (`400`, `404`, etc.) with concise `error` strings.
- For complex queries, keep transformation from DB shape to API shape in dedicated mapping object.

## 6) Database and query standards

- Import Drizzle schema from `db/schema` and use typed queries.
- Build and use helper seed/fixtures only in tests; avoid test-only assumptions in production code.
- Use local helper default DB injection in route handlers for testability.
- Avoid embedding SQL text strings unless existing ORM pattern justifies it.
- Never hardcode production credentials in code; always read from env vars.
- Be careful with `Date` serialization/deserialization in API responses; keep explicit conversions as needed.

## 7) Component patterns

- Use the project’s import ordering convention: external imports first, alias imports (`@/...`) next.
- Components should be function components using hooks and explicit props interfaces.
- Keep UI composition small and reusable; prefer extracting repeated UI fragments.
- Use existing shadcn/ui primitives in `src/components/ui` where applicable.
- For client components, include `"use client"` only where browser APIs/hooks are required.

## 8) Testing requirements

- Add or update tests whenever behavior changes.
- Unit test APIs by invoking route handlers directly where possible (`handleXxx` + optional DB injection).
- Add wrapper tests for route wiring/params/status code behavior when route boundaries are important.
- In tests, prefer mock-friendly in-memory DB setup helpers and deterministic seeds.
- Use `vi.spyOn` for fetch behavior and restore mocks in teardown (`afterEach`).
- Keep assertions on both shape and status codes when touching API responses.
- For streaming/async hooks, use `waitFor`, `act`, and event loop-aware assertions.

## 9) New feature workflow

- 1. Implement change in smallest coherent unit (route/lib/component).
- 2. Add or update tests before finalizing behavior.
- 3. Run: `bun run lint`, `bun run typecheck`, and focused test file at least.
- 4. Run full checks before large merges (`bun run test:coverage` + `bun run build`) if touched areas are broad.

## 10) Files to avoid modifying unnecessarily

- Prefer not to touch unrelated files unless required by the task.
- Do not touch migration-generated artifacts without explicit need.
- Respect existing patterns instead of broad refactors.

## 11) Environment and secrets

- `.env` / `.env.local` are local; never embed secrets in code or commit them.
- Required local envs: `TURSO_DATABASE_URL`, optional `TURSO_AUTH_TOKEN`.
- Optional integrations use Google OAuth credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, etc.).
- If adding/using env vars, update `.env.example` and relevant docs.

## 12) Logging and error behavior

- Keep logs structured and non-noisy; avoid logging sensitive user inputs.
- Return user-safe errors in API endpoints; avoid leaking raw internal details.
- Ensure loading/error states are surfaced in UI components and cleaned up on completion.

## 13) Directory and config checks this repo expects

- No `.cursor/rules`, `.cursorrules`, or `.github/copilot-instructions.md` currently exist.
- If any future agent instructions appear in those locations, treat them as higher priority local instructions.

## 14) Suggested PR hygiene

- Mention command outputs (`lint`, `typecheck`, tests) in summary.
- Provide concise rationale for logic changes in code review comments.
- If test additions are added, include coverage implications and any skipped areas.

## 15) Practical style notes

- Prefer `await` with `async` handlers over chained promises for readability.
- Keep magic strings in constants or enums when repeated.
- Use descriptive variable names for IDs and route params (`threadId`, `agentId`).
- For arrays/lists, avoid mutating input objects; use functional updates.
- Keep imports sorted and avoid dead imports; lint will enforce many of these.

## 16) Git workflow expectations (when requested)

- Do not amend commits unless explicitly requested and safe by context.
- Avoid destructive git operations.
- If creating commits, keep messages concise and intent-focused.

## 17) Runbook reminders

- Start with targeted changes and tests, then broaden.
- If unknown behavior appears, check related tests first before changing logic.
- If uncertain, prefer smallest diff consistent with existing route and test patterns.
