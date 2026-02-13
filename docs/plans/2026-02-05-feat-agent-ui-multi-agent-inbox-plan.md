---
title: "feat: Multi-Agent Inbox UI"
type: feat
date: 2026-02-05
---

# feat: Multi-Agent Inbox UI

## Overview

Build a flexible, extensible web UI for managing multiple AI agents. A unified inbox where users can monitor, interact with, and manage agent threads across different agent backends that communicate via the AG-UI protocol.

**Vision:** "Claude Cowork but more open"—protocol-first design that works with any AG-UI compliant agent.

## Problem Statement / Motivation

Currently, there's no open, flexible UI for managing multiple AI agents from different sources. Users who want to:

- Run agents built with Claude SDK, OpenCode SDK, or other frameworks
- Have a unified view across all their agents
- Maintain conversation history that survives agent restarts
- Interact with agents via human-in-the-loop patterns

...must build custom UIs for each agent or use framework-specific tools that lock them into one ecosystem.

## Proposed Solution

A Next.js web application with:

1. **AG-UI Protocol Integration** via CopilotKit (open source)
   - Connect to any AG-UI compliant agent endpoint
   - Handle streaming, state sync, reconnection automatically

2. **Multi-Agent Inbox**
   - Register agents via JSON config file
   - View all threads organized by agent
   - Track unread messages and thread status

3. **Thread Chat Interface**
   - Real-time streaming message display
   - Human input when agents request it
   - Full conversation history

4. **Supabase Persistence** (UI-owned)
   - Store all threads and messages
   - Unified history across agents
   - Survives agent restarts

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Agent UI (Next.js App Router)              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Inbox     │  │   Thread    │  │   Agent Sidebar     │  │
│  │   List      │  │   Chat      │  │   (from config)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │   CopilotKit Layer (useCopilotChat, HttpAgent)      │    │
│  │   - AG-UI protocol handling                          │    │
│  │   - Streaming state management                       │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │   Supabase Client (@supabase/ssr)                   │    │
│  │   - Persistence layer                                │    │
│  │   - Real-time subscriptions                          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                       AG-UI Protocol
                       (SSE/WebSocket)
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌────────────┐      ┌────────────┐      ┌────────────┐
   │ Claude SDK │      │ OpenCode   │      │ Any AG-UI  │
   │   Agent    │      │   Agent    │      │   Agent    │
   └────────────┘      └────────────┘      └────────────┘
```

## Technical Considerations

### CopilotKit Integration

Use CopilotKit's open source AG-UI client with custom UI:

```typescript
// app/api/copilotkit/route.ts
import { CopilotRuntime, ExperimentalEmptyAdapter } from "@copilotkit/runtime";
import { HttpAgent } from "@ag-ui/client";

// Load agents from config
const agentsConfig = loadAgentsConfig();

const runtime = new CopilotRuntime({
  agents: Object.fromEntries(
    agentsConfig.map((agent) => [agent.id, new HttpAgent({ url: agent.endpoint_url })])
  ),
});
```

**Key packages:**

- `@copilotkit/react-core` - hooks (useCopilotChat)
- `@copilotkit/runtime` - backend runtime
- `@ag-ui/client` - HttpAgent for external endpoints

### Agent Configuration

JSON config file at `agents.config.json`:

```json
{
  "agents": [
    {
      "id": "claude-coder",
      "name": "Claude Coder",
      "endpoint_url": "http://localhost:8001/agui",
      "icon": "🤖",
      "description": "Coding assistant powered by Claude"
    },
    {
      "id": "opencode-analyst",
      "name": "OpenCode Analyst",
      "endpoint_url": "http://localhost:8002/agui",
      "icon": "📊",
      "description": "Code analysis agent"
    }
  ]
}
```

### Database Schema (Supabase)

```sql
-- Agents table (synced from config, stores runtime state)
CREATE TABLE agents (
    id text PRIMARY KEY,
    name text NOT NULL,
    endpoint_url text NOT NULL,
    icon text,
    description text,
    status text DEFAULT 'unknown', -- online, offline, unknown
    last_seen_at timestamptz,
    config jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Threads table
CREATE TABLE threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id text REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
    title text,
    status text DEFAULT 'active', -- active, paused, completed, error
    last_activity_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX threads_agent_id_idx ON threads(agent_id);
CREATE INDEX threads_last_activity_idx ON threads(last_activity_at DESC);

-- Messages table
CREATE TABLE messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id uuid REFERENCES threads(id) ON DELETE CASCADE NOT NULL,
    role text NOT NULL, -- user, assistant, system, tool
    content text NOT NULL,
    metadata jsonb DEFAULT '{}', -- tool calls, attachments, etc.
    created_at timestamptz DEFAULT now()
);

CREATE INDEX messages_thread_id_idx ON messages(thread_id, created_at DESC);

-- Inbox view with last message
CREATE VIEW inbox_view AS
WITH last_messages AS (
    SELECT DISTINCT ON (thread_id)
        thread_id,
        content as last_message,
        role as last_message_role,
        created_at as last_message_at
    FROM messages
    ORDER BY thread_id, created_at DESC
)
SELECT
    t.id,
    t.agent_id,
    t.title,
    t.status,
    t.last_activity_at,
    t.created_at,
    a.name as agent_name,
    a.icon as agent_icon,
    lm.last_message,
    lm.last_message_role,
    lm.last_message_at
FROM threads t
JOIN agents a ON a.id = t.agent_id
LEFT JOIN last_messages lm ON lm.thread_id = t.id
ORDER BY COALESCE(lm.last_message_at, t.created_at) DESC;
```

### Project Structure

```
agent-ui/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Redirect to /inbox
│   ├── api/
│   │   └── copilotkit/
│   │       └── route.ts        # CopilotKit runtime endpoint
│   ├── inbox/
│   │   ├── page.tsx            # Inbox list view
│   │   └── layout.tsx          # Inbox layout with sidebar
│   └── thread/
│       └── [id]/
│           └── page.tsx        # Thread chat view
├── components/
│   ├── inbox/
│   │   ├── InboxList.tsx       # Thread list component
│   │   ├── InboxItem.tsx       # Single thread preview
│   │   └── AgentFilter.tsx     # Filter by agent
│   ├── thread/
│   │   ├── ChatThread.tsx      # Main chat container
│   │   ├── MessageList.tsx     # Message display
│   │   ├── MessageBubble.tsx   # Single message
│   │   └── ChatInput.tsx       # User input
│   ├── sidebar/
│   │   ├── AgentSidebar.tsx    # Agent list sidebar
│   │   └── AgentCard.tsx       # Single agent display
│   └── ui/                     # Shared UI components
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser client
│   │   └── server.ts           # Server client
│   ├── agents/
│   │   ├── config.ts           # Load agent config
│   │   └── types.ts            # Agent types
│   └── hooks/
│       ├── useRealtimeMessages.ts
│       └── useInbox.ts
├── types/
│   └── database.types.ts       # Generated Supabase types
├── agents.config.json          # Agent configuration
└── supabase/
    └── migrations/             # Database migrations
```

## Acceptance Criteria

### Core Functionality

- [x] Connect to multiple AG-UI agent endpoints defined in config
- [x] Display agent sidebar showing all registered agents with status
- [x] Show inbox list of all threads, ordered by last activity
- [x] Create new thread with selected agent
- [x] Stream messages from agent in real-time
- [x] Send user messages to agent
- [ ] Persist all threads and messages to Supabase (schema ready, needs Supabase connection)
- [ ] Restore thread history on page reload (needs Supabase connection)

### User Experience

- [x] Show loading states during agent communication
- [x] Display agent typing/processing indicators
- [x] Handle agent errors gracefully with retry option
- [x] Auto-scroll to new messages
- [ ] Optimistic message display while sending (partially implemented)

### Technical Requirements

- [x] TypeScript throughout
- [x] Responsive layout (desktop-first, mobile-friendly)
- [ ] Real-time updates via Supabase subscriptions (needs Supabase connection)
- [x] Proper error boundaries

## Success Metrics

- Can connect to at least 2 different agent endpoints simultaneously
- Thread history persists across browser sessions
- Messages stream in real-time without visible delay
- New agent can be added by editing config file only (no code changes)

## Dependencies & Risks

### Dependencies

- **CopilotKit** - AG-UI client implementation (MIT, well-maintained)
- **Supabase** - Persistence layer (requires account setup)
- **External agents** - Need AG-UI compliant agents to test against

### Risks

| Risk                       | Impact | Mitigation                           |
| -------------------------- | ------ | ------------------------------------ |
| CopilotKit API changes     | High   | Pin versions, monitor releases       |
| Agent endpoint unavailable | Medium | Graceful error handling, retry logic |
| Supabase rate limits       | Low    | Batch writes, connection pooling     |

## Implementation Phases

### Phase 1: Foundation

- Next.js project setup with TypeScript
- Supabase project and schema setup
- Basic layout (sidebar, main content area)
- Agent config loading

### Phase 2: CopilotKit Integration

- CopilotKit runtime with HttpAgent
- Single agent connection test
- Basic chat interface (hardcoded agent)

### Phase 3: Multi-Agent & Persistence

- Multiple agent registration
- Thread CRUD operations
- Message persistence
- Inbox view

### Phase 4: Polish

- Real-time subscriptions
- Error handling
- Loading states
- Responsive design

## References & Research

### Internal

- Brainstorm: `docs/brainstorms/2026-02-05-agent-ui-brainstorm.md`

### External

- [AG-UI Protocol Docs](https://docs.ag-ui.com)
- [CopilotKit Documentation](https://docs.copilotkit.ai)
- [Supabase Next.js Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [@ag-ui/client HttpAgent](https://github.com/ag-ui-protocol/ag-ui)

### Code Patterns

**CopilotKit with external agents:**

```typescript
import { HttpAgent } from "@ag-ui/client";
const agent = new HttpAgent({ url: "http://agent-endpoint/agui" });
```

**Supabase real-time subscription:**

```typescript
supabase
  .channel(`thread:${threadId}`)
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `thread_id=eq.${threadId}`,
    },
    handleNewMessage
  )
  .subscribe();
```
