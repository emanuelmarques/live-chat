<!--
Sync Impact Report
Version change: 1.0.0 → 1.1.0
Modified principles:
  - II. Test-First for Correctness-Critical Logic: dropped "topic/question clustering
    and deduplication" from the non-negotiable test list (that capability was removed).
  - IV. Minimal, Named Participation Data: "post-event report" → "exported chat
    transcript" (the feature changed; the data-minimalism rule did not).
  - V. Moderator Authority Over Automation: generalized from "AI" to "automated
    checks" so the principle covers the project's current block-list-based
    moderation, not only AI-based automation; dropped the now-removed
    topic/question-clustering clause.
Added sections: none
Removed sections: none
Changed sections:
  - Technology & Scale Constraints: removed the Claude/AI dependency for
    moderation, topic/question clustering, and the post-event report. The product
    now has no AI/LLM dependency: moderation uses a moderator-managed block-list,
    and the former report is a plain exported chat transcript. Topic/question
    clustering ("live insights") is removed as a capability, not merely
    re-implemented without AI.
Rationale for this amendment: the project owner decided against taking on an
  Anthropic API dependency; the three AI-backed features were re-scoped
  accordingly (see specs/001-hybrid-event-chat/spec.md Clarifications).
Templates requiring follow-up: none — this command does not modify dependent templates;
  /speckit-plan, /speckit-tasks, and /speckit-implement read this file at runtime.
Deferred placeholders: none
-->

# Live Chat Constitution

## Core Principles

### I. Right-Sized Simplicity (YAGNI)
The system MUST be built for its actual scale: hybrid events with roughly 100–150
concurrent participants, a single moderator/admin, and one event running at a time.
Every design and implementation choice MUST default to the simplest solution that
satisfies the current requirement — a single web application, a single managed
real-time datastore, no bespoke infrastructure. Multi-tenant moderation, multi-admin
roles, horizontal scaling, and platform integrations (e.g., YouTube/Zoom chat ingestion)
MUST NOT be built speculatively; they are deferred until a concrete requirement demands
them, at which point they go through a new specification, not a silent expansion of
scope during implementation.
Rationale: this is a small-scale, single-tenant tool today. Premature generalization
would spend effort on infrastructure no event will exercise, at the cost of the
features participants and the moderator actually use.

### II. Test-First for Correctness-Critical Logic (NON-NEGOTIABLE)
Any logic where a human cannot easily eyeball correctness during a live event MUST be
covered by tests written before implementation, following Red-Green-Refactor: poll vote
counting and result aggregation, and the moderation hold/approve/reject state machine.
Tests MUST fail before the implementation exists and MUST pass before the change is
considered done. UI layout and copy are exempt from this rule; stateful, numeric, or
decision logic is not.
Rationale: these are the paths where a silent bug directly produces a wrong number on
a projector screen in front of a live audience, or an unfair/incorrect moderation
decision — mistakes that cannot be quietly patched mid-event.

### III. Live Consistency Across Surfaces
The projector screen, participant mobile view, and moderator panel MUST reflect the
same underlying event state (active poll, live/revealed results, highlighted message,
pending-approval status) without manual refresh, and MUST converge within a few seconds
of a state change. When a participant's message is held for moderation, that participant
MUST see an "awaiting approval" status rather than a silently dropped or falsely-sent
message. No surface may show state that contradicts another surface for longer than the
sync delay.
Rationale: the product's core value is a shared, synchronized experience for a hybrid
audience; any surface drifting out of sync (e.g., projector shows a poll that is already
closed on mobile) breaks the premise of the tool during the one moment — the live event
— when it cannot be fixed after the fact.

### IV. Minimal, Named Participation Data
Participants MUST identify with a display name to post; there is no anonymous posting
and no account/login requirement. The system MUST collect no more personal data than a
display name and the content a participant submits. Message and vote history MUST be
retained only as long as needed to run the live event and produce the exported chat
transcript, with retention/deletion behavior defined explicitly rather than left implicit.
Rationale: named-but-login-free participation was chosen deliberately to keep the entry
barrier low (scan a QR code, type a name) while keeping moderation accountable; anything
beyond that is data the product does not need and should not default to keeping.

### V. Moderator Authority Over Automation
Automated checks MUST only be used to flag suspect messages for the moderator — they
MUST NOT autonomously delete, block, or publish content without passing through the
moderator's approve/reject action. Every automated moderation flag MUST be traceable
back to the source message so the moderator can verify why it was held. The moderator
panel MUST surface system health that affects trust in the event (size of the
pending-approval queue, poll participation) prominently enough to act on in real time.
Rationale: a single human moderator is accountable for what happens on the projector
screen; automation exists to reduce their workload, not to make unreviewable decisions
on their behalf. This holds regardless of what the automated check is — a block-list
match today, potentially something more sophisticated later — the moderator's final
say is the invariant, not the mechanism.

## Technology & Scale Constraints

The product is a responsive web application (desktop and mobile; no native app) written
in TypeScript, requiring no installation for participants, moderator, or the projected
screen. Real-time delivery (chat, polls, state sync) MUST use a managed real-time
datastore/service rather than a self-managed realtime server, consistent with Principle I.
The product is independent of any specific streaming platform (YouTube, Zoom, or other);
it MUST NOT depend on ingesting or embedding a third-party platform's native chat.
The product has no AI/LLM dependency: moderation flagging uses a moderator-managed
block-list of terms/phrases, and the event export is a plain chat transcript — there
is no topic/question clustering or AI-generated analysis. UI copy is English-only;
message content itself is free-form and MUST NOT be restricted by language. Hosting
MUST be a managed cloud platform requiring no server maintenance, sized for one
concurrent event of up to ~150 participants, not for multi-event concurrency or
horizontal scale-out.

## Development Workflow

Each feature MUST go through specification (`/speckit-specify`) and planning
(`/speckit-plan`) before implementation tasks are generated, so that scope decisions —
especially anything that would expand beyond Principle I's right-sized scope — are made
explicitly rather than discovered mid-build. Any plan or task that introduces
multi-tenant support, multi-admin roles, third-party chat platform integration, or other
scope excluded by Principle I MUST call out that deviation explicitly and justify it;
reviewers MUST treat an unexplained expansion of scope as a defect, not a judgment call.
Changes touching the logic covered by Principle II MUST include their tests in the same
change, not as follow-up work.

## Governance

This constitution supersedes other informal practices for this project. Amendments
require: (1) the change written out in this file with updated placeholders/content, (2)
a version bump following semantic versioning — MAJOR for backward-incompatible
principle removal/redefinition, MINOR for a new principle or materially expanded
guidance, PATCH for clarification or wording fixes — and (3) the Sync Impact Report at
the top of this file updated to describe the change. `/speckit-plan` and
`/speckit-implement` MUST verify compliance with this constitution as part of their own
workflow (e.g., a plan's Constitution Check gate); complexity or scope that conflicts
with Principle I MUST be justified in the plan before implementation proceeds.

**Version**: 1.1.0 | **Ratified**: 2026-10-24 | **Last Amended**: 2026-10-24
