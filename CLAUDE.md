# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
bun dev              # Start Next.js dev server at localhost:3000

# Build & Lint
bun run build        # Production build
bun run lint         # ESLint (Next.js + TypeScript rules)

# Tests (Playwright e2e)
bunx playwright test                     # Run all tests
bunx playwright test tests/app.spec.ts   # Run a specific test file
bunx playwright test -g "test name"      # Run test by name
bunx playwright test --headed            # Run with visible browser

# Supabase (local)
npx supabase start   # Start local Supabase (serves at localhost:54321)
```

## Architecture

Multi-agent inbox UI built with Next.js 16 (App Router) that communicates with AI agents via the AG-UI protocol through CopilotKit.

### Core Flow

1. **Agent Configuration**: Agents are defined in `agents.config.json` at the project root. Each agent has an `id`, `name`, `endpoint_url` (AG-UI protocol endpoint), `icon`, and `description`. Adding a new agent only requires editing this file.

2. **AG-UI Protocol Bridge**: The `/api/copilotkit` route creates a `CopilotRuntime` that instantiates `HttpAgent` instances for each configured agent. This bridges the CopilotKit client to remote AG-UI agent endpoints.

3. **Chat Interface**: `ChatThread` wraps CopilotKit's `useCopilotChat()` hook which manages streaming messages, loading states, and stop-generation. Messages are transformed between CopilotKit's internal format and the UI's `MessageBubble` components.

4. **Data Persistence**: Supabase PostgreSQL stores agents, threads, and messages. The `inbox_view` SQL view denormalizes thread data with last-message previews. Realtime is enabled on the messages table.

### Key Directories

- `src/components/inbox/` — Inbox list, filtering, thread previews
- `src/components/thread/` — Chat UI (MessageList, MessageBubble, ChatInput)
- `src/components/sidebar/` — Agent list sidebar, new thread dialog
- `src/components/providers/` — AppLayout root client component
- `src/components/ui/` — shadcn/ui primitives (New York style, Lucide icons)
- `src/lib/agents/` — Agent config loading and types
- `src/lib/hooks/` — Supabase data hooks (useInbox, useMessages)
- `src/lib/supabase/` — Browser and server Supabase clients
- `src/types/database.types.ts` — Generated Supabase types
- `supabase/migrations/` — Database schema migrations

### Routes

- `/` → redirects to `/inbox`
- `/inbox` — Thread list (all or filtered by agent)
- `/thread/[id]` — Individual thread chat view
- `/api/copilotkit` — AG-UI protocol endpoint (POST)
- `/api/mock-agent` — Test agent endpoint

### Tech Stack

- **Package manager**: Bun
- **UI components**: shadcn/ui (Radix UI + Tailwind CSS 4)
- **Path alias**: `@/` maps to `src/`
- **Database**: Supabase (local dev at `localhost:54321`)
- **Env vars**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`)
