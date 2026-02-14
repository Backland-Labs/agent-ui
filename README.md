# Agent UI

Multi-agent inbox UI built with Next.js 16 (App Router) that communicates with AI agents via the [AG-UI protocol](https://github.com/ag-ui-protocol/ag-ui) through CopilotKit.

## Prerequisites

- [Bun](https://bun.sh/) (package manager and runtime)

## Setup

1. Install dependencies:

```bash
bun install
```

2. Copy the environment file:

```bash
cp .env.example .env.local
```

Local dev uses a file-based SQLite database (`file:local.db`) by default -- no external services needed. For production, set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for Turso cloud.

3. Start the dev server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Note: This repository snapshot does not include `src/` or `tests/` directories.

Those directories have been removed by request, so this README is focused on configuration, scripts, and docs instead of in-tree application routes/components.

## Agent Configuration

Agents are defined in `agents.config.json` at the project root. Each entry has an `id`, `name`, `endpoint_url` (AG-UI protocol endpoint), and `description`. To add a new agent, add an entry to this file.

## Scripts

| Command                                                   | Description                                         |
| --------------------------------------------------------- | --------------------------------------------------- |
| `bun dev`                                                 | Start Next.js dev server                            |
| `bun run build`                                           | Production build                                    |
| `bun run lint`                                            | ESLint                                              |
| `bun run format`                                          | Format all files with Prettier                      |
| `bun run format:check`                                    | Check formatting (CI)                               |
| `bun run typecheck`                                       | Type-check without emitting                         |
| `bun run test`                                            | Run unit tests (Vitest)                             |
| `bun run test:watch`                                      | Run unit tests in watch mode                        |
| `bun run test:coverage`                                   | Run unit tests with coverage                        |
| `bun run opencode:append-thread [pr-number] [session-id]` | Post session transcript to a PR as a marked comment |
| `bunx playwright test`                                    | Run end-to-end tests (Playwright)                   |

## Architecture

### Core Flow

1. **Agent Configuration** -- Agents defined in `agents.config.json` are loaded at startup.
2. **AG-UI Protocol Bridge** -- The `/api/copilotkit` route creates a `CopilotRuntime` that instantiates `HttpAgent` instances for each configured agent, bridging CopilotKit to remote AG-UI endpoints.
3. **Chat Interface** -- `ChatThread` wraps CopilotKit's `useCopilotChat()` hook for streaming messages, loading states, and stop-generation.
4. **Data Persistence** -- Turso (libSQL/SQLite) stores agents, threads, and messages. Local dev uses a file-based SQLite database; production uses Turso cloud.

### Key Directories

```
db/              -- Turso/libSQL client, schema, and migrations
scripts/         -- Repository maintenance and automation scripts
docs/            -- Design notes, plans, and implementation notes
public/          -- Static assets
```

### Routes

- Source routes are not present in this snapshot.

### Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **UI**: shadcn/ui (Radix UI + Tailwind CSS 4)
- **Database**: Turso (libSQL/SQLite); local dev uses `file:local.db`
- **Networking**: Tailscale (private access to agent endpoints)
- **Hosting**: Railway
- **Agent Protocol**: AG-UI via CopilotKit
- **Testing**: Vitest (unit), Playwright (e2e)
- **Package Manager**: Bun
