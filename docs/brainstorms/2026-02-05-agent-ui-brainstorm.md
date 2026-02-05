# Agent UI Brainstorm

**Date:** 2026-02-05
**Status:** Ready for planning

## What We're Building

A flexible, extensible web UI for managing multiple AI agents. Think "Claude Cowork but more open"—a unified inbox where you can monitor, interact with, and manage agent threads across different agent backends.

### Core Concept

- **Protocol-first design**: Uses AG-UI (Agent-User Interaction Protocol) so any compliant agent works
- **Decoupled architecture**: Agents run remotely (containers, servers) and communicate over the network
- **Unified inbox**: All agent threads in one place, organized by agent, with full history

## Why This Approach

### AG-UI Protocol
- Industry standard (Google, Microsoft, Anthropic, LangChain all support it)
- Event-based streaming handles long-running agent tasks naturally
- Built-in support for human-in-the-loop patterns
- Framework-agnostic—works with any agent that speaks the protocol

### UI-Owned Persistence (Supabase)
- Unified view across all agents
- History survives agent restarts
- Enables search, filtering, thread management
- Agents stay stateless/simple

### CopilotKit Open Source
- Battle-tested AG-UI React client
- Handles protocol complexity (17 event types, streaming, reconnection)
- MIT licensed, no paid dependencies needed
- We customize UI layer on top

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Protocol | AG-UI | Industry standard, framework-agnostic |
| Agent integration | Config file (JSON) | Simple, declarative, easy to add new agents |
| Platform | Web (React/Next.js) | CopilotKit has first-party React support |
| AG-UI client | CopilotKit (open source) | Don't reinvent protocol handling |
| Persistence | Supabase (UI-owned) | Unified inbox, resilient to agent restarts |
| Initial agents | Claude SDK, OpenCode SDK | Your primary use cases |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Agent UI (Next.js)                 │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Inbox     │  │   Thread    │  │  Agent Config   │  │
│  │   View      │  │   View      │  │    Sidebar      │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│              CopilotKit AG-UI Client                    │
│         (handles protocol, streaming, state)            │
├─────────────────────────────────────────────────────────┤
│                    Supabase Backend                     │
│    ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│    │  Agents  │  │ Threads  │  │    Messages      │    │
│    │  Config  │  │          │  │                  │    │
│    └──────────┘  └──────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────┘
                           │
                    AG-UI Protocol
                    (SSE/WebSocket)
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Claude SDK   │  │ OpenCode SDK │  │  Any AG-UI   │
│    Agent     │  │    Agent     │  │    Agent     │
└──────────────┘  └──────────────┘  └──────────────┘
     (container)      (container)      (anywhere)
```

## Data Model (Supabase)

### `agents` table
- `id` (uuid, pk)
- `name` (text)
- `endpoint_url` (text) - AG-UI endpoint
- `icon` (text) - emoji or URL
- `description` (text)
- `config` (jsonb) - agent-specific settings
- `created_at`, `updated_at`

### `threads` table
- `id` (uuid, pk)
- `agent_id` (uuid, fk)
- `title` (text) - auto-generated or user-set
- `status` (enum: active, paused, completed, error)
- `last_activity_at` (timestamp)
- `created_at`, `updated_at`

### `messages` table
- `id` (uuid, pk)
- `thread_id` (uuid, fk)
- `role` (enum: user, assistant, system, tool)
- `content` (text)
- `metadata` (jsonb) - tool calls, attachments, etc.
- `created_at`

## MVP Features

1. **Agent sidebar**: List registered agents from config, show status
2. **Thread inbox**: List threads grouped by agent, show unread/status
3. **Thread view**: Chat interface with streaming messages
4. **Human input**: Text input when agent requests it
5. **Basic persistence**: Save/restore threads and messages

## Out of Scope (for MVP)

- User authentication (single-user for now)
- Tool execution visualization (just show tool calls as messages)
- A2UI dynamic UI rendering
- Voice/multimodal input
- Agent-to-agent communication

## Open Questions

1. **Agent config format**: What metadata do we need beyond endpoint URL?
2. **Thread resumption**: How do we restore agent context when resuming a thread?
3. **Error handling**: What happens when an agent endpoint is unreachable?

## Next Steps

Run `/workflows:plan` to create implementation plan.
