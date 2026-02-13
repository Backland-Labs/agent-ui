# Agent UI

Multi-agent inbox UI built with Next.js 16 (App Router) that communicates with AI agents via the [AG-UI protocol](https://github.com/ag-ui-protocol/ag-ui) through CopilotKit.

## Prerequisites

- [Bun](https://bun.sh/) (package manager and runtime)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local database)

## Setup

1. Install dependencies:

```bash
bun install
```

2. Copy the environment file and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

3. Start local Supabase:

```bash
npx supabase start
```

4. Start the dev server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Agent Configuration

Agents are defined in `agents.config.json` at the project root. Each entry has an `id`, `name`, `endpoint_url` (AG-UI protocol endpoint), and `description`. To add a new agent, add an entry to this file.

## Scripts

| Command                 | Description                       |
| ----------------------- | --------------------------------- |
| `bun dev`               | Start Next.js dev server          |
| `bun run build`         | Production build                  |
| `bun run lint`          | ESLint                            |
| `bun run format`        | Format all files with Prettier    |
| `bun run format:check`  | Check formatting (CI)             |
| `bun run typecheck`     | Type-check without emitting       |
| `bun run test`          | Run unit tests (Vitest)           |
| `bun run test:watch`    | Run unit tests in watch mode      |
| `bun run test:coverage` | Run unit tests with coverage      |
| `bunx playwright test`  | Run end-to-end tests (Playwright) |

## Architecture

### Core Flow

1. **Agent Configuration** -- Agents defined in `agents.config.json` are loaded at startup.
2. **AG-UI Protocol Bridge** -- The `/api/copilotkit` route creates a `CopilotRuntime` that instantiates `HttpAgent` instances for each configured agent, bridging CopilotKit to remote AG-UI endpoints.
3. **Chat Interface** -- `ChatThread` wraps CopilotKit's `useCopilotChat()` hook for streaming messages, loading states, and stop-generation.
4. **Data Persistence** -- Supabase PostgreSQL stores agents, threads, and messages. An `inbox_view` SQL view denormalizes thread data with last-message previews. Realtime is enabled on the messages table.

### Key Directories

```
src/
  components/
    inbox/       -- Inbox list, filtering, thread previews
    thread/      -- Chat UI (MessageList, MessageBubble, ChatInput)
    sidebar/     -- Agent list sidebar, new thread dialog
    providers/   -- AppLayout root client component
    ui/          -- shadcn/ui primitives
  lib/
    agents/      -- Agent config loading and types
    hooks/       -- Supabase data hooks (useInbox, useMessages)
    supabase/    -- Browser and server Supabase clients
  types/         -- Generated Supabase types
supabase/
  migrations/    -- Database schema migrations
```

### Routes

- `/` -- redirects to `/inbox`
- `/inbox` -- Thread list (all or filtered by agent)
- `/thread/[id]` -- Individual thread chat view
- `/api/copilotkit` -- AG-UI protocol endpoint (POST)
- `/api/mock-agent` -- Test agent endpoint

### Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **UI**: shadcn/ui (Radix UI + Tailwind CSS 4)
- **Database**: Supabase (PostgreSQL + Realtime)
- **Agent Protocol**: AG-UI via CopilotKit
- **Testing**: Vitest (unit), Playwright (e2e)
- **Package Manager**: Bun
