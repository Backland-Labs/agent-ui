---
date: 2026-02-14
topic: main-landing-ui
---

# Main Landing UI

## What We're Building

Create a dedicated landing page at `/` that acts as a daily command center before users move into thread-level work. The page should combine three core areas: (1) an email-agent daily digest of recent email activity, (2) prominent calendar access, and (3) a visible agent inbox that feels like a traditional email client where agent tasks and agent responses appear as incoming messages.

The goal is to reduce time-to-triage each day. Users should be able to quickly understand what changed, what needs action now, and where to click next. The landing page is not a replacement for full inbox/thread workflows; it is a high-signal overview that drives users into existing detailed views.

## Why This Approach

We considered inbox-first, digest-first, and balanced split-view directions. The selected direction is a digest-led experience for context, while keeping the inbox visually dominant for action. This preserves the user's preference for operational focus (inbox as the primary workspace) without losing the executive summary value of a daily briefing.

Compared with a perfectly balanced dashboard, this approach gives clearer decision flow: understand priorities quickly, then act. It also avoids over-complicating the first version by keeping deeper interactions in existing inbox/thread views.

## Key Decisions

- Dedicated landing route: `/` will become a real landing page rather than an immediate redirect.
- Core modules: include all three required areas on landing - daily email-agent digest, prominent calendar agenda, and agent inbox.
- Inbox behavior on day one: show a preview list and route users into full thread/inbox views for deeper interaction.
- Inbox tone and metaphor: make the inbox feel like a familiar email client where agent work arrives as new mail.
- Empty state behavior: when no new items exist, show a clean "all caught up" style state.
- Success criteria: optimize for faster daily triage.

## Resolved Questions

- Scope: build a dedicated `/` landing page (not just refresh `/inbox`).
- Digest format: use a concise daily digest summary rather than a raw event feed.
- Calendar emphasis: make calendar a prominent agenda section on landing.
- Visual hierarchy tie-breaker: inbox remains the dominant visual anchor.

## Open Questions

- None at this stage.

## Next Steps

-> `/workflows:plan` for implementation details.
