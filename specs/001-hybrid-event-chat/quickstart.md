# Quickstart: Hybrid Event Live Chat

Validation guide for proving the feature works end-to-end. Function/table details
are in `contracts/` and `data-model.md` — not repeated here.

## Prerequisites

- Node.js 20+ and npm (or pnpm)
- A Convex account and the Convex CLI (`npx convex dev` provisions a dev deployment)
- Two or more browser windows/profiles to simulate separate participants

No AI/LLM API key is needed — moderation uses a moderator-managed block-list, and
chat export is a plain CSV, not an AI-generated report (see `spec.md`'s
Clarifications → "Amendment 2026-10-24").

## Setup

```bash
npm install
npx convex dev        # provisions/links the Convex dev deployment, generates convex/_generated
npm run dev            # starts the Vite dev server for src/
```

`npx convex dev` and `npm run dev` both need to stay running (two terminals) during
manual validation.

## Automated checks

```bash
npm run test:unit        # Vitest: frontend unit/component tests
npx convex-test           # convex-test: backend function unit/contract tests
npm run test:e2e           # Playwright: multi-client + accessibility smoke checks
```

## Manual validation scenarios

Each scenario below maps to one user story in `spec.md` and should be run after the
corresponding tasks are implemented.

### 1. Join and chat (User Story 1)

1. As the moderator, create an event; note the join link and QR code shown.
2. Open the join link in two separate browser windows ("Room" and "Remote"), plus a
   third window on the projector route for that event.
3. In "Room", enter a display name and send a message with an emoji.
4. **Expect**: the message appears in "Remote" and on the projector view within a
   few seconds, in order, with no account/login step anywhere.
5. Reply to that message from "Remote"; **expect** the reply visibly references the
   original on all three views.
6. Delete the original message from "Room"; **expect** it disappears everywhere, and
   the reply's reference now reads as a deleted-original indicator.
7. As the moderator, end the event; reload the join link; **expect** a clear
   "this event has ended" state instead of chat access.

### 2. Moderated chat (User Story 2)

1. As the moderator, add a test term (e.g., `bannedword`) to the block-list.
2. Start a new event; join as one participant.
3. Send an ordinary message — **expect** it appears immediately everywhere.
4. Send a message containing `bannedword` — **expect** it does *not* appear on the
   projector or to other participants, and the sender's own view shows an
   "awaiting approval" state.
5. As the moderator, open the moderation queue, and approve it — **expect** it then
   appears everywhere, positioned by its original send time.
6. Repeat with a second message containing `bannedword` and reject it instead —
   **expect** it never appears to anyone but the moderator.
7. Remove the test term from the block-list; **expect** a subsequent message
   containing it is no longer held.

### 3. Live polls (User Story 3)

1. As the moderator, create a poll with 3 options and `revealMode: live`; start it.
2. **Expect**: every participant view and the projector immediately show the
   active-poll highlight.
3. Vote from one participant; **expect** the visible result breakdown updates within
   a few seconds on views where results are shown.
4. Try voting again from the same participant — **expect** it's rejected.
5. End the poll; **expect** the highlight clears everywhere and no further votes are
   accepted.
6. Repeat with `revealMode: atEnd` — **expect** no result breakdown is visible until
   the moderator explicitly reveals it.

### 4. Export event chat (User Story 4)

1. In an event with some chat history (from scenarios 1–3 above, including at least
   one reply, one moderator-approved message, and one deleted message), as the
   moderator, request a CSV export.
2. **Expect**: a CSV file downloads containing one row per currently-visible
   message (sender display name, content, sent time), in chronological order.
3. **Expect**: the deleted message and any rejected/still-pending message do not
   appear in the file.
4. Export the chat again without ending the event — **expect** it works on a live
   event, not only an ended one.
5. Create a second event, send a distinct message in it, and export that event's
   chat — **expect** the file contains only the second event's message, not
   anything from the first.

## Accessibility smoke check

Using keyboard only (no mouse), complete: joining an event, sending a message,
replying, deleting your own message, and — as the moderator — approving a held
message and creating/starting a poll. Every one of these must be reachable and
operable via keyboard with a visible focus indicator (FR-036). Run the Playwright
accessibility pass (`npm run test:e2e`) for the automated version of this check on
the participant and moderator views (the projector view is exempt).
