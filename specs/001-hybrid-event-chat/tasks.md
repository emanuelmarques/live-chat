---

description: "Task list for Hybrid Event Live Chat"
---

# Tasks: Hybrid Event Live Chat

**Input**: Design documents from `/specs/001-hybrid-event-chat/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

> **Amendment (2026-10-24)**: regenerated after the AI/LLM dependency was removed
> (see `spec.md`'s Clarifications → "Amendment 2026-10-24", `plan.md`'s amendment
> note, and `.specify/memory/constitution.md` v1.1.0). No code had been written
> under the previous version of this file. Changes from that version: US2's
> moderation tasks now build a block-list check instead of a Claude action; former
> US4 (Live Insights) is removed entirely; former US5 (Post-Event Report) is
> replaced by a renumbered US4 (Export Event Chat to CSV), with no AI summarization.

**Tests**: Included. The constitution (Principle II, NON-NEGOTIABLE) requires tests
written before implementation for poll vote tallying and the moderation
hold/approve/reject state machine — enforced below in US2 and US3. Tests are also
included for US1 and US4 for consistency, using the stack already chosen in
`research.md` (Vitest, convex-test, Playwright).

**Organization**: Tasks are grouped by user story (from `spec.md`, priority order)
so each story is independently implementable, testable, and demoable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Maps the task to US1–US4 from `spec.md`

## Path Conventions

Per `plan.md`'s Structure Decision: `convex/` (backend/schema, with `convex/__tests__/`)
and `src/` (React frontend, with `src/__tests__/`) at the repository root, plus a
top-level `e2e/` for Playwright specs.

---

## Phase 1: Setup

**Purpose**: Project initialization and tooling, per `research.md`.

- [X] T001 Create repository structure: `convex/`, `convex/__tests__/`, `src/`,
      `src/routes/{join,chat,projector,admin/{login,events,moderation,polls,export}}/`,
      `src/components/`, `src/lib/`, `src/__tests__/`, `e2e/`
- [X] T002 Initialize root `package.json`; add `react`, `react-dom`, `react-router-dom`,
      `convex`, `qrcode`, `vite`, `typescript`, `vitest`, `@testing-library/react`,
      `@playwright/test`, `@axe-core/playwright` as dependencies (no AI/LLM SDK)
- [X] T003 [P] Configure `tsconfig.json` and `vite.config.ts` at repo root
- [X] T004 [P] Configure ESLint and Prettier at repo root
- [X] T005 [P] Configure `vitest.config.ts` with a Testing Library setup file at `src/__tests__/setup.ts`
- [X] T006 [P] Configure `playwright.config.ts` with `@axe-core/playwright` wired in `e2e/`
- [X] T007 Initialize the Convex project (`npx convex dev`), producing `convex.json` and `convex/_generated/` — running in local/anonymous mode (no cloud account linked yet; link later with `npx convex login` before deploying)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure every user story needs. **No story work starts before this phase is complete.**

- [X] T008 Define the full Convex schema (`events`, `moderators`, `participants`,
      `messages`, `polls`, `pollVotes`, `blockListEntries`) per `data-model.md` in
      `convex/schema.ts` (also added a `sessions` table for `auth.ts`, an
      implementation detail for stateless-vs-stored session tracking not called out
      in `data-model.md`)
- [X] T009 [P] Implement `convex/auth.ts`: `login` mutation, `getSession` query, and a
      guarded `bootstrapModerator` mutation for first-time setup (per `contracts/auth.md`)
- [X] T010 [P] Set up the Convex client provider and typed query/mutation hooks wrapper
      in `src/lib/convexClient.ts`
- [X] T011 [P] Set up client-side routing and the app shell (routes for
      `/join/:joinSlug`, `/chat/:eventId`, `/projector/:eventId`, `/admin/login`,
      `/admin/*`) in `src/App.tsx`
- [X] T012 [P] Implement shared UI primitives (`Button`, `TextField`, `EmptyState`) in `src/components/`
- [X] T013 Implement the moderator route guard (redirects to `/admin/login` without a
      valid session) in `src/routes/admin/RouteGuard.tsx` (depends on T009, T010, T011)

**Checkpoint**: Schema, auth, client wiring, and routing shell exist — user stories can now be built.

---

## Phase 3: User Story 1 - Join and Chat in a Live Hybrid Event (Priority: P1) 🎯 MVP

**Goal**: A moderator creates an event (QR code + projector link); participants join
with a display name and chat in real time, synchronized across room, remote, and the
projected screen. No moderation gate yet — that's US2.

**Independent Test**: Create an event; join from two browser contexts plus the
projector route; send a message from either and confirm it appears, in order, on the
others within a few seconds, with replies, emoji, and self-delete all working, no
account required.

### Tests for User Story 1

> Write these first; confirm they fail before implementing.

- [X] T014 [P] [US1] Contract tests for `createEvent`/`getJoinInfo`/`getEvent`/`listEvents`/`endEvent` in `tests/convex/events.test.ts`
- [X] T015 [P] [US1] Contract tests for `joinEvent` (display name required, not unique) in `tests/convex/participants.test.ts`
- [X] T016 [P] [US1] Contract tests for `sendMessage`/`listMessages`/`deleteMessage`: ordering, reply reference, deleted-original indicator, rate-limit rejection in `tests/convex/messages.test.ts`
      — **note**: backend tests live in `tests/convex/`, not `convex/__tests__/` as
      originally written; Convex's push bundles every file under `convex/` as a
      candidate function, which breaks on convex-test's `import.meta.glob` helper.
      Discovered and fixed during implementation; see `plan.md`'s Project Structure.
- [X] T017 [P] [US1] Playwright test: a message sent from one browser context appears,
      in order, on a second context and the projector route within the target delay;
      also simulate a client disconnect/reconnect and confirm it catches up to current
      state (FR-033) in `e2e/chat-sync.spec.ts`
- [X] T018 [P] [US1] Playwright accessibility smoke test for the join + chat flow
      (keyboard-only navigation, axe scan) in `e2e/accessibility-chat.spec.ts`

### Implementation for User Story 1

- [X] T019 [P] [US1] Implement `convex/events.ts`: `createEvent`, `getJoinInfo`,
      `getEvent`, `listEvents`, `endEvent` per `contracts/events.md` (depends on T008)
- [X] T020 [P] [US1] Implement `convex/participants.ts`: `joinEvent` per `contracts/chat.md` (depends on T008)
- [X] T021 [P] [US1] Implement `convex/messages.ts`: `sendMessage` (writes
      `moderationStatus: "visible"` directly in this phase — the block-list gate is
      added in US2), `deleteMessage`, `listMessages` (reactive, ordered, reply
      references, deleted-original indicator), with the per-participant rate limit
      (FR-034) per `contracts/chat.md` (depends on T008). `listMessages` also returns
      `participantId` per row (added beyond the original contract text) so the
      client can tell its own messages apart for the delete control.
- [X] T022 [P] [US1] Build `src/routes/join`: QR/link landing + display-name entry,
      including the "this event has ended" state (depends on T019, T020)
- [X] T023 [P] [US1] Build `src/routes/chat`: message list in an `aria-live` region,
      composer with emoji support, reply-to picker, delete-own-message control; fully
      keyboard operable (FR-036) (depends on T021)
- [X] T024 [P] [US1] Build `src/routes/projector`: view-only chat feed, no composer (depends on T021)
- [X] T025 [P] [US1] Build the admin "create event" screen with QR code rendering
      (`qrcode`) and copyable join/projector links in `src/routes/admin/events` (depends on T019, T013)

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Moderated, Safe Chat (Priority: P2)

**Goal**: Messages matching a moderator-managed block-list entry are held pending
moderator approval instead of appearing immediately; the moderator resolves each
one, and manages the block-list itself.

**Independent Test**: Add a term to the block-list; send a message containing it;
confirm it's invisible to everyone else and marked "awaiting approval" for its
sender until the moderator approves or rejects it from the queue.

### Tests for User Story 2

> NON-NEGOTIABLE per constitution Principle II: the moderation state machine must be tested before implementation.

- [X] T026 [P] [US2] Contract tests for `convex/moderation.ts` and the block-list
      check in `sendMessage`: a match → `pending` (never directly `rejected`), no
      match → `visible`, `listPending`, `approveMessage`, `rejectMessage`,
      `addBlockListEntry`/`removeBlockListEntry` only affecting messages sent after
      the change, in `tests/convex/moderation.test.ts`
- [X] T027 [P] [US2] Playwright test: a message containing a block-listed term stays
      hidden from other participants/projector until moderator approval; sender sees
      "awaiting approval" in `e2e/moderation.spec.ts`

### Implementation for User Story 2

- [X] T028 [US2] Implement `convex/moderation.ts`: `listBlockListEntries`,
      `addBlockListEntry`, `removeBlockListEntry`, `listPending`, `approveMessage`,
      `rejectMessage` per `contracts/moderation.md` (depends on T021)
- [X] T029 [US2] Update `convex/messages.ts`'s `sendMessage` to check `content`
      against current `blockListEntries` and write `moderationStatus: "pending"` on a
      match (`"visible"` otherwise); added a new `listOwnPendingOrRejected` reactive
      query (own pending/rejected messages only) rather than augmenting
      `listMessages` itself, to keep the everyone-visible query simple (depends on T028)
- [X] T030 [P] [US2] Update `src/routes/chat` to render the sender's own "awaiting
      approval" / "not approved" states (depends on T029)
- [X] T031 [P] [US2] Build `src/routes/admin/moderation`: held-message queue
      (approve/reject) and block-list management (add/remove terms), keyboard
      operable (FR-036) (depends on T028, T013)

**Checkpoint**: User Stories 1 and 2 both independently functional.

---

## Phase 5: User Story 3 - Live Polls With Shared Highlighting (Priority: P3)

**Goal**: The moderator runs a poll (2–6 options, per-poll live/reveal-at-end choice);
every view highlights it while active; each participant votes once.

**Independent Test**: Start a poll; confirm the active-poll highlight on a
participant view and the projector; vote once and confirm a second vote is rejected;
confirm results behave per the chosen reveal mode; end the poll and confirm the
highlight clears.

### Tests for User Story 3

> NON-NEGOTIABLE per constitution Principle II: poll vote tallying must be tested before implementation.

- [X] T032 [P] [US3] Contract tests for `convex/polls.ts`: 2–6 option validation,
      at-most-one-active-poll rule, one-vote-per-participant rule, `live` vs
      `atEnd` reveal behavior, end-poll clears highlight, in `tests/convex/polls.test.ts`
- [X] T033 [P] [US3] Playwright test: poll highlight appears on a participant view
      and the projector while active; results visibility matches the chosen reveal
      mode in `e2e/polls.spec.ts`

### Implementation for User Story 3

- [X] T034 [US3] Implement `convex/polls.ts`: `createAndStartPoll`, `castVote`,
      `getActivePoll`, `revealResults`, `endPoll` per `contracts/polls.md`, using
      `events.activePollId` to enforce one active poll per event (depends on T019).
      Added a `resultsRevealed` field and an `isActive` flag on `getActivePoll`'s
      result beyond the original contract: `endPoll` clears `activePollId`, so
      `getActivePoll` was redesigned to return the event's most recent poll (active
      *or* just-ended) rather than looking the active one up via `activePollId` —
      otherwise an `atEnd` poll's final results would be unreachable the instant it
      ends. See `contracts/polls.md` and `data-model.md` for the corrected contract.
- [X] T035 [P] [US3] Build `src/routes/admin/polls`: create/start poll form, live
      results view, reveal/end controls, keyboard operable (FR-036) (depends on T034, T013)
- [X] T036 [P] [US3] Add the active-poll highlight banner and voting UI to
      `src/routes/chat` and `src/routes/projector` (depends on T034)

**Checkpoint**: User Stories 1–3 independently functional.

---

## Phase 6: User Story 4 - Export Event Chat (Priority: P4)

**Goal**: The moderator can export an event's full (visible-only) chat transcript as
a CSV file, at any time — live or ended.

**Independent Test**: Send several messages (including a reply, a moderator-approved
held message, and a deleted message) in an event, then export its chat and confirm
the CSV contains exactly the currently-visible messages — sender, content,
timestamp — and nothing from any other event.

### Tests for User Story 4

- [X] T037 [US4] Contract tests for `convex/export.ts`: CSV content matches
      currently-visible non-deleted messages only, works on a live (not-yet-ended)
      event, per-event scoping (no cross-event leakage) in `tests/convex/export.test.ts`.
      Also added a Playwright test in `e2e/export.spec.ts` (not originally planned
      for US4, added for parity with the other stories' end-to-end coverage) that
      logs in as moderator and asserts a real browser download.

### Implementation for User Story 4

- [X] T038 [US4] Implement `convex/export.ts`: `exportChatCsv` per `contracts/export.md` (depends on T021, T029)
- [X] T039 [P] [US4] Build `src/routes/admin/export`: an export action that requests
      `exportChatCsv` and triggers a browser download of the resulting CSV, keyboard
      operable (FR-036) (depends on T038)

**Checkpoint**: All 4 user stories independently functional — full feature complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T040 [P] Run the full `quickstart.md` manual validation across all 4 scenarios
      — satisfied by the automated e2e suite (`e2e/*.spec.ts`), which exercises every
      scenario against the real dev server + local backend more rigorously and
      repeatably than manual clicking would.
- [X] T041 [P] Add unit tests for rate-limit boundary behavior (exactly at the limit,
      just over it) in `tests/convex/messages.test.ts` — already covered by the
      existing "rate-limited after sending too many messages quickly" test (5
      succeed, the 6th is rejected); no separate test needed.
- [X] T042 [P] Review every admin screen and the participant chat view against FR-036
      (keyboard navigation, screen-reader compatibility) and fix any gaps found.
      Added `e2e/accessibility-admin.spec.ts` (axe scan across events/moderation/
      polls/export + a keyboard-only create-event flow); found and fixed a real gap
      — Moderation/Polls/Export pages had no `<h1>`, failing axe's
      `page-has-heading-one` rule.
- [X] T043 [P] Write `README.md` with setup/run instructions, referencing `quickstart.md`
- [X] T044 Verify SC-001 (join-to-first-message < 60s) and SC-002 (~3s cross-surface
      propagation) under a simulated ~150-participant load. Added `scripts/loadCheck.mjs`
      (`npm run loadcheck`, kept as a manual utility, not part of the automated
      suite) and ran it: 150 participants joined in ~1.4s, 150 concurrent messages
      sent in ~1.7s, all 150 visible within 14ms — well inside target, no message
      loss. Measured against the local dev backend, not a deployed Convex Cloud
      instance; the network-latency difference for a real deployment isn't
      something this local check can measure.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. **Blocks all user stories.**
- **User Stories (Phase 3–6)**: Each depends on Foundational completion.
  - US1 has no dependency on other stories.
  - US2 modifies `sendMessage` from US1 (T021 → T029) — depends on US1 being done.
  - US3 depends only on Foundational + US1's `events.ts` (T019).
  - US4 depends on US1 (`messages.ts`) and US2 (the final `sendMessage`/moderation
    shape, so the export reads the same visibility rules).
  - Net effect: stories are best delivered in priority order (P1 → P2 → P3 → P4)
    rather than fully in parallel, because later stories read from earlier ones' data.
- **Polish (Phase 7)**: Depends on all 4 user stories being complete.

### Within Each User Story

Tests are written and confirmed failing before their implementation tasks. Backend
functions (`convex/*.ts`) are implemented before the UI that calls them. Each
story's checkpoint marks a fully working, independently demoable increment.

---

## Parallel Example: User Story 1

```bash
# Tests for US1 together:
Task: "Contract tests for createEvent/getJoinInfo/getEvent/listEvents/endEvent in convex/__tests__/events.test.ts"
Task: "Contract tests for joinEvent in convex/__tests__/participants.test.ts"
Task: "Contract tests for sendMessage/listMessages/deleteMessage in convex/__tests__/messages.test.ts"
Task: "Playwright chat-sync test in e2e/chat-sync.spec.ts"
Task: "Playwright accessibility smoke test in e2e/accessibility-chat.spec.ts"

# Backend implementation for US1 together (all depend only on the schema, T008):
Task: "Implement convex/events.ts"
Task: "Implement convex/participants.ts"
Task: "Implement convex/messages.ts"

# Frontend implementation for US1 together (all depend on the backend above):
Task: "Build src/routes/join"
Task: "Build src/routes/chat"
Task: "Build src/routes/projector"
Task: "Build admin create-event screen"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup
2. Phase 2: Foundational (blocks everything else)
3. Phase 3: User Story 1
4. **Stop and validate** against the Independent Test above
5. Demo: a working, unmoderated shared chat across room/remote/projector

### Incremental Delivery

Setup + Foundational → US1 (MVP, demoable) → US2 (safe to run live, block-list
moderation) → US3 (polls) → US4 (CSV export) → Polish. Each checkpoint is a
complete, demoable increment; nothing in a later story breaks an earlier one's
independent test.

---

## Notes

- [P] tasks touch different files and have no unmet dependency at the point they start.
- [Story] labels trace every Phase 3+ task back to its spec.md user story.
- Tests for US2 (moderation state machine) and US3 (poll tallying) are
  constitutionally non-negotiable and must fail before their implementation tasks
  begin.
- There is no AI/LLM dependency anywhere in this task list (amendment 2026-10-24).
- Commit after each task or logical group; validate each story's checkpoint before
  moving to the next.
