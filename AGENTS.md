# AGENTS

Use this document as repo-specific guidance for all coding agents working in
`/Users/max/code/agent-ui`.

## 1) Scope and stack overview

- Project: Agent UI built with Next.js 16 App Router and React 19.
- Language/runtime: TypeScript 5 with Bun for scripts, install, test, and lint workflows.
- Data layer: `drizzle-orm` + `@libsql/client` (libSQL/Turso).
- Agent orchestration surface: AG-UI via CopilotKit route and local client state.
- UI system: shadcn/ui + Radix primitives, with existing `src` references removed from this workspace.

## 2) Required project commands

- `bun dev` starts local app with Turbopack and pino-pretty logs.
- `bun run build` compiles production bundle.
- `bun run lint` runs ESLint.
- `bun run format` runs Prettier over the repository.
- `bun run format:check` validates formatting.
- `bun run typecheck` runs TypeScript checks with `tsc --noEmit`.
- `bun run test` runs `vitest run` on all unit tests.
- `bun run test:watch` runs Vitest in watch mode.
- `bun run test:coverage` runs tests with coverage reporting.
- `bun run db:generate` regenerates migration metadata.
- `bun run db:migrate` runs migration script.
- `bun run db:push` pushes schema updates.
- `bun run db:studio` opens Drizzle Studio.
- `bunx playwright test` runs E2E suite.
- `bun run opencode:append-thread <pr-number> <session-id>` posts an opencode session thread.

### 2.1) Targeted test commands

- Single test by name:
  `bun run test -t "loads initial threads"`.
- Single Playwright run: `bunx playwright test`.
- Single Playwright title: `bunx playwright test -g "creates thread"`.

Note: `src/` and `tests/` are removed in this workspace snapshot.

### 2.2) CI-equivalent baseline

- CI runs, in order, `bun run typecheck`, `bun run lint`, `bun run format:check`,
  `bun run build`, and `bun run test:coverage`.
- Local changes intended for PR should run this same set before large merges.

## 3) Instruction hierarchy

- Prioritize: system prompt > repository-level instructions (`CLAUDE.md`) > `AGENTS.md`.
- If future `.cursor/rules`, `.cursorrules`, or `.github/copilot-instructions.md` appear,
  they override this file for the scope they define.
- At present, no such files exist in this repository.

## 4) Files and architecture map

- `db/**`: schema, client, migration metadata, and migration scripts.
- `scripts/**`: repo maintenance and automation scripts.
- `docs/**`: design notes, plans, and implementation notes.
- `agents.config.json`: agent endpoint registry and metadata.
- `README.md`: runbooks and architecture summary.

## 5) Core coding conventions

- Use strict TypeScript; prefer concrete types over implicit `any`.
- Use `type` for object/shape aliases, `interface` when extending object-oriented patterns.
- Keep route handlers small; move reusable logic into helper functions where possible.
- Use early returns for validation and guard clauses.
- Keep side effects near entrypoints (routes, hooks, effects), and pure transforms in helper functions.
- Use `const` for immutable bindings unless mutation is explicitly needed.
- Export named symbols unless a file is strongly single-purpose default export.
- Avoid "clever" one-liners; prefer explicit code paths the next agent can read quickly.

## 6) Import and module ordering

- Prefer external imports first.
- Then alias imports from `@/`.
- Then relative imports.
- Keep import groups separated by a blank line.
- Use absolute imports for app code where practical (`@/...`) to avoid long relative chains.
- Delete unused imports immediately; do not suppress with comments.

## 7) Formatting and lint conventions

- Use existing Prettier settings from `.prettierrc` (`printWidth: 100`, `trailingComma: es5`).
- Keep lines readable; refactor when format indicates unclear structure.
- Keep semantically related utility functions together in modules.
- Do not manually format with custom styles that fight ESLint/Prettier.
- Run `bun run lint` and `bun run format` after manual edits in touched files.

## 8) Error handling and responses

- In `route.ts`, use explicit status codes for bad input and domain errors:
  `400`, `404`, `409`, and `500` when appropriate.
- Return stable payload keys: e.g. `{ error: "..." }` for failures, structured success payloads for success.
- Validate request data before DB writes.
- Keep user-facing error text high level; avoid returning raw internal stack traces.
- Prefer `try/catch` around async operations and log with non-sensitive context.

## 9) Route and API patterns

- Exports should use Next App Router verbs (`GET`, `POST`, etc.).
- Keep parsing/validation near boundary, and business logic in injected helpers.
- For DB-dependent logic, allow optional injection of default DB context for testability.
- Map DB rows to API DTOs in explicit conversion helpers.
- Preserve existing conventions for thread routes and agent endpoints.

## 10) Database standards

- Read/write through Drizzle query builders rather than ad-hoc string SQL where possible.
- Keep migration files focused and avoid manual edits unless required by schema changes.
- Never hardcode environment secrets or tokens.
- Use named parameters / explicit filters to avoid accidental broad writes.
- Treat `Date` values carefully in serialization paths; ensure UTC consistency where possible.

## 11) Component patterns

- Use function components with explicit props typings.
- Mark client components with `"use client"` only when needed.
- Keep component props minimal and predictable.
- Favor composition over deep prop drilling.
- Use existing `ui` primitives to stay consistent with style and accessibility behavior.
- Keep hooks inside components only, and avoid conditional hooks.

## 12) Testing expectations

- Add or update tests for changed behavior.
- Test route contracts (status, body shape) as well as happy path.
- Prefer deterministic seeds and local fixtures in DB-related tests.
- Use focused assertions for async state transitions.
- Keep coverage meaningful; avoid brittle selectors in component tests.
- Mock external services with local test stubs; keep tests resilient to network variance.

## 13) Test file placement and naming

- Unit test files should use `.test.ts`/`.test.tsx`.
- Route tests under `**/__tests__/` or matching directory conventions.
- Keep test description strings concrete and aligned with business behavior.
- Co-locate tests near implementation when they are specific and stable.

## 14) Logging and observability

- Prefer existing logger patterns (Pino) over raw logs.
- Log failure causes with context enough to reproduce while avoiding sensitive payloads.
- Keep logs concise and structured JSON-like key-value pairs.
- Avoid logging full request bodies when they can contain tokens, credentials, or PII.

## 15) Naming standards

- Use descriptive identifiers: `threadId`, `agentId`, `messageInput`, `copilotPayload`.
- Avoid abbreviations unless standard (`id`, `db`, `url`).
- Use verb-noun names for handlers: `fetchThreads`, `createThread`, `transformThreadRow`.
- Constants should communicate intent (`MAX_THREADS_PER_PAGE`, `DEFAULT_POLL_INTERVAL_MS`).

## 16) Work discipline

- Start with smallest possible coherent change.
- Keep PR scope tightly related to the ticket/request.
- Do not perform broad refactors unless explicitly requested.
- Leave unrelated formatting-only churn out unless file formatting must change.
- If behavior is uncertain, inspect existing tests before touching core logic.

## 17) Environment and configuration

- Use `.env.local` for local secrets and `bun dev` assumptions.
- For Turso production setup, keep `TURSO_DATABASE_URL` and optional
  `TURSO_AUTH_TOKEN` outside the source tree.
- If adding env vars, update `README.md` and `.env.example` where appropriate.
- Never commit credentials, `.env` files, or personal tokens.

## 18) Security and safety

- Validate external input before DB access and outbound requests.
- Use allow-listed transformations before presenting user data.
- Avoid creating SQL/command injection surfaces by direct concatenation.
- Review access checks when adding new authenticated paths.

## 19) PR and reporting expectations

- Include explicit command evidence (lint/typecheck/test) in PR notes.
- Mention schema or migration impact clearly.
- Note any skipped checks and why.
- Keep summaries short, outcome-focused, and reviewer-friendly.

## 20) Practical workflow reminders

- Do not amend commits unless explicitly requested.
- Do not use destructive git operations unless the user asks for them.
- Prefer incremental delivery and narrow PRs.
- If an instruction conflicts with current repository conventions, follow existing local patterns.
