# Implementation Plan: Hybrid Event Live Chat

**Branch**: `001-hybrid-event-chat` | **Date**: 2026-10-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-hybrid-event-chat/spec.md`

**Amendment (2026-10-24)**: The original plan used Claude for moderation flagging,
topic/question clustering ("live insights"), and post-event report generation. The
project owner decided against an AI/LLM dependency before any code was written. This
plan is updated accordingly: moderation now uses a moderator-managed block-list
(deterministic text match), live insights is removed as a capability, and the
post-event report is replaced with a plain CSV export of the chat transcript. See
`spec.md`'s Clarifications → "Amendment 2026-10-24" and
`.specify/memory/constitution.md` v1.1.0.

## Summary

A single web app gives a hybrid (in-room + remote) event one shared, moderated chat:
participants join via QR code/link and post under a display name; a projected screen
shows the same chat live; a moderator holds a queue for block-list-flagged messages,
runs polls with a per-poll live/reveal-at-end choice, and can export the event's full
chat transcript as a CSV file. Technically, this is delivered as a TypeScript React
frontend talking to Convex (a managed, reactive, serverless TypeScript backend) for
data and real-time sync — no AI/LLM provider is used anywhere. This matches the
constitution's requirement for a managed real-time service with no self-managed
server and no horizontal-scale infrastructure at this ~150-participant, one-event
scale.

## Technical Context

**Language/Version**: TypeScript 5.x throughout (Node.js 20+ for backend functions, evergreen browsers for the client)

**Primary Dependencies**: React 18 + Vite (frontend), Convex (reactive datastore + serverless functions/real-time sync), `qrcode` (QR rendering). No AI/LLM SDK.

**Storage**: Convex's built-in document datastore (managed; no separately-provisioned database)

**Testing**: Vitest + Testing Library (frontend unit/component), convex-test (backend function unit/contract tests), Playwright (end-to-end multi-client sync flows and accessibility smoke checks)

**Target Platform**: Responsive web app in modern desktop and mobile browsers (no native app); one view also designed for projection on a shared screen

**Project Type**: Web application (single frontend + one managed backend/real-time service)

**Performance Goals**: New message visible on all surfaces within ~3s (SC-002); join-to-first-message under 60s (SC-001); live poll results update within a few seconds of a vote (SC-006)

**Constraints**: ≤150 concurrently active participants per event (SC-003); at most one active poll per event (FR-017); block-list match is a synchronous, local, deterministic check (no external call, so no "slow/unavailable" failure mode); per-participant message rate limit sized to stop flooding without disrupting normal conversation (FR-034); participant and moderator views keyboard-navigable and screen-reader compatible, no formal compliance level set (FR-036)

**Scale/Scope**: One live event at a time, one moderator account (schema allows more later without rework), up to ~150 simultaneous participants, 4 prioritized user stories (chat, moderation, polls, chat export)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Constitution principle | Check | Status |
|---|---|---|
| I. Right-Sized Simplicity (YAGNI) | One frontend + one managed backend, no multi-tenant/multi-admin features, no third-party chat-platform ingestion, no AI/LLM dependency. A `moderators` table is included so the schema doesn't need reshaping later, but no multi-admin behavior (roles, permissions UI) is built now — schema foresight, not feature scope. | PASS |
| II. Test-First for Correctness-Critical Logic | Poll vote tallying and the moderation hold/approve/reject state machine (block-list match) each get contract/unit tests written before their implementation task (enforced at `/speckit-tasks` time). | PASS (enforced in tasks phase) |
| III. Live Consistency Across Surfaces | Participant view, projector, and moderator panel all subscribe to the same Convex reactive queries; Convex pushes updates to every subscriber automatically, which is the mechanism satisfying "within a few seconds, no surface contradicts another." | PASS |
| IV. Minimal, Named Participation Data | Participants are stored as display name + event id only, no account/credentials; message/poll data is scoped per event (FR-030) and retained only through export availability (per spec Assumptions). | PASS |
| V. Moderator Authority Over Automation | The block-list check is a synchronous match inside the `sendMessage` mutation itself — it can only route a message to `pending`, never to `rejected`; only a moderator-triggered mutation (`approveMessage`/`rejectMessage`) resolves it. Per-participant rate limiting is a mechanical flood guard, not a content judgment, so it doesn't need per-message moderator sign-off. | PASS |
| Technology & Scale Constraints | TypeScript end-to-end, responsive web (no native app), Convex as the managed real-time datastore (no self-managed realtime server), no YouTube/Zoom ingestion, no AI/LLM dependency, English-only UI copy, hosting (Vercel + Convex Cloud) sized for one concurrent event, not multi-event scale-out. | PASS |
| Development Workflow | This plan stays within the spec's scope; no multi-tenant/multi-admin/platform-integration expansion is introduced. Tests for Principle II's correctness-critical logic ship in the same tasks as their implementation, not as follow-up. | PASS |

No violations identified. The Complexity Tracking table below is intentionally empty.

**Post-Design Re-check** (after Phase 1 artifacts below): `data-model.md`'s
`moderators` table stores only credentials for the single v1 account, with no
roles/permissions logic (Principle I holds). `contracts/moderation.md` confirms the
block-list check only ever routes a message to `pending` — `approveMessage` and
`rejectMessage` are the only functions that can make a message visible or
permanently hidden, and both require moderator auth (Principle V holds).
`contracts/chat.md`'s `listMessages` and `polls.md`'s `getActivePoll` being reactive
queries, subscribed to identically by participant, projector, and moderator clients,
is what satisfies Principle III — confirmed, not just planned. No new violations
were introduced during design; Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-hybrid-event-chat/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
convex/                  # Managed backend: schema + serverless functions (deployed to Convex Cloud)
├── schema.ts             # Tables: events, moderators, sessions, participants, messages,
│                         #   polls, pollVotes, blockListEntries
├── lib/                   # requireModerator, password hashing (non-function helpers)
├── events.ts               # createEvent, getEvent, endEvent, getJoinInfo (QR/link target)
├── participants.ts         # joinEvent (creates participant for the event)
├── messages.ts              # sendMessage (incl. block-list check + rate limit), deleteMessage,
│                         #    listMessages (reactive query), replyTo handling
├── moderation.ts             # listBlockListEntries, addBlockListEntry, removeBlockListEntry,
│                         #    listPending, approveMessage, rejectMessage
├── polls.ts                   # createAndStartPoll, castVote, getActivePoll, revealResults, endPoll
├── export.ts                    # exportChatCsv
└── auth.ts                        # moderator login/session check

tests/convex/             # convex-test unit/contract tests, one file per convex/*.ts module.
│                         # Deliberately NOT under convex/ itself: Convex's push bundles every
│                         # file under convex/ as a candidate function module, and chokes on
│                         # Vite-only syntax (import.meta.glob, used by convex-test's module
│                         # loader) — discovered during implementation, see git history.

src/                      # Frontend (React + Vite + TypeScript)
├── routes/
│   ├── join/              # QR/link landing + display-name entry
│   ├── chat/                # participant chat view (mobile + desktop)
│   ├── projector/             # projected-screen view (chat + active poll highlight)
│   └── admin/                   # moderator panel
│       ├── login/
│       ├── events/                 # create event, QR code, event list
│       ├── moderation/               # held-message queue + block-list management
│       ├── polls/                      # create/start/reveal/end poll
│       └── export/                       # chat CSV export action
├── components/              # shared UI: message bubble, poll card, QR code
├── lib/                      # Convex client hooks, formatting/time helpers
└── __tests__/                  # Vitest + Testing Library component/accessibility tests

e2e/                      # Playwright end-to-end specs (multi-client sync, moderation flow,
│                         #   poll flow, accessibility smoke checks)
```

**Structure Decision**: Single repository with Convex's standard top-level `convex/`
backend folder alongside a `src/` React frontend — not a `backend/` + `frontend/`
monorepo split. At this project's scale (one small frontend, one managed backend),
a workspace/monorepo split would add dependency- and build-management overhead with
no corresponding benefit (Principle I). `convex/` and `src/` each own their own
tests close to the code they verify; `e2e/` holds the cross-surface (participant +
projector + moderator) scenarios that no single package can test alone.

## Complexity Tracking

*No Constitution Check violations — this table is intentionally left empty.*
