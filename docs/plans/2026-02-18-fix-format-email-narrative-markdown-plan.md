---
title: "fix: Format email narrative markdown"
type: bug
date: 2026-02-18
detail_level: minimal
status: completed
issue: https://github.com/Backland-Labs/agent-ui/issues/12
brainstorm: docs/brainstorms/2026-02-14-main-landing-ui-brainstorm.md
---

# fix: Format email narrative markdown

## Overview

Render `narrative` from `/api/narrative` as safe markdown in the landing Email Narrative card so headings and lists are readable instead of raw markdown syntax.

## Context

- Markdown-like narrative text is already returned by the API proxy (`src/app/api/narrative/route.ts`).
- The hook passes that value through as a plain string (`src/lib/hooks/useNarrative.ts`).
- The card currently renders narrative in a plain paragraph (`src/components/landing/AgentInboxPreview.tsx`).

## Acceptance Criteria

- [x] In success state, narrative markdown renders formatted output (headings, lists, emphasis, inline code, links).
- [x] Existing narrative states remain unchanged: loading, empty, terminal error, and refresh error overlay.
- [x] API and hook contracts remain unchanged (`narrative: string`).
- [x] Raw HTML is not rendered as active HTML.
- [x] Unsafe URL schemes are blocked; external links use safe `target`/`rel` behavior.
- [x] Empty/whitespace/sanitized-empty narrative shows `No narrative details returned.`.
- [x] Component tests cover formatting and safety; existing state tests stay green.

## MVP Scope

- Use `react-markdown` + `remark-gfm` in `src/components/landing/AgentInboxPreview.tsx`.
- Do not enable raw HTML parsing.
- Keep styling compact and scoped to the narrative section.
- Do not change route/hook behavior or digest/calendar sections.

## Task Checklist

- [x] Add markdown rendering for the narrative success view.
- [x] Add safe link handling configuration.
- [x] Update `src/components/landing/__tests__/landing-components.test.tsx` with markdown + safety assertions.
- [x] Run `bun run test src/components/landing/__tests__/landing-components.test.tsx`.
- [x] Run `bun run test src/components/landing/__tests__/LandingContent.test.tsx`.
- [x] Run `bun run typecheck`.
- [x] Run `bun run lint`.

## References

- Issue: `https://github.com/Backland-Labs/agent-ui/issues/12`
- UI: `src/components/landing/AgentInboxPreview.tsx`
- Hook: `src/lib/hooks/useNarrative.ts`
- Route: `src/app/api/narrative/route.ts`
- Tests: `src/components/landing/__tests__/landing-components.test.tsx`
