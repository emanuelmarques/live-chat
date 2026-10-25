# Feature Specification: Hybrid Event Live Chat

**Feature Branch**: `001-hybrid-event-chat`

**Created**: 2026-10-24

**Status**: Draft

**Input**: User description: "Quero criar uma app que leve a experiência do chat numa live/podcast de YouTube para um evento presencial híbrido, para facilitar a interação com a audiência: visão de gestão para gerir eventos e recolher tópicos mais tocados, dúvidas frequentes e padrões; ao criar um evento, QR code e um ecrã que possa ser projetado para a audiência ver o chat; utilizadores entram e falam no chat, veem mensagens de outros, respondem, identificam-se com nome (sem anónimos), mensagens podem ter emojis; o moderador pode iniciar sondagens, os utilizadores respondem e há destaque enquanto a sondagem decorre; utilizável em desktop e mobile. Resolvido durante a conversa: interface só em inglês (mensagens em qualquer língua); moderação por IA que retém mensagens suspeitas para aprovação do moderador; sondagens com escolha, por sondagem, entre resultados em direto ou revelados no fim; painel do moderador com tópicos e dúvidas em destaque, como frases com resumo, não palavras soltas; relatório final com análise geral; ~100-150 participantes por evento; um único moderador por agora."

## Clarifications

### Session 2026-10-24

- Q: When someone opens an event's QR code or link before the moderator has started it, or after it has ended, what should happen? → A: Before the moderator ends the event, joining and posting work the same whether or not the moderator has done anything else to "start" it — there is no separate waiting-room state. After the moderator ends the event, opening the QR code/link is blocked with a clear "this event has ended" message instead of chat access.
- Q: If the real-time chat backend itself (not just one participant's connection) has an outage mid-event, should this spec define a formal availability target and degraded mode, or defer to the reliability of whichever managed service is chosen later? → A: No formal target in this spec; rely on the managed service's own reliability, with each participant's device automatically reconnecting and catching up on missed messages once connectivity returns.
- Q: Should a single participant be limited in how many messages they can send in a short time, to prevent flooding the chat/projected screen, or is that out of scope for now? → A: Yes — a simple per-participant rate limit is in scope, sized to stop flooding without disrupting normal conversation.
- Q: After a message is sent, can the participant who wrote it edit or delete it themselves, or is that out of scope (only the moderator can remove content, via rejection)? → A: A participant can delete their own previously sent message (no editing of content); once deleted it disappears from every surface.
- Q: Should this spec require a specific accessibility level (e.g., screen readers, keyboard navigation) for the participant and moderator views, or defer that to later? → A: A basic requirement — keyboard navigation and screen-reader compatibility — applies to the participant and moderator views (the projected screen is view-only and is exempt); no formal compliance level (e.g., WCAG AA) is set by this spec.

### Amendment 2026-10-24: Remove the AI/LLM dependency

Discovered during implementation planning, before any code was written. The project
owner decided against taking on an AI API dependency. This amendment re-scopes the
three features that had been AI-backed:

- Q: Without an AI provider, how should message moderation flag suspect content? → A: A moderator-managed block-list of terms/phrases. A message matching an entry is held pending approval, exactly as before — only the detection mechanism changes (deterministic text matching instead of an AI classifier).
- Q: What should replace the AI-generated post-event report (top topics, top questions, poll results, participation summary)? → A: Nothing generated — instead, the moderator can export the event's full chat transcript to a CSV file. The "live insights" capability (grouping messages into topics/questions with descriptive labels, and the live activity view) is removed entirely, not reimplemented without AI; it depended on the same capability being removed.

This amendment removes former User Story 4 (Live Insights) in full, revises User
Story 2 (Moderated, Safe Chat) to describe block-list-based flagging instead of AI
classification, and replaces former User Story 5 (Post-Event Report) with a
simpler User Story 4 (Export Event Chat). All functional requirements, success
criteria, edge cases, and assumptions below already reflect this amendment — none
of the AI-specific language from the original draft remains.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Join and Chat in a Live Hybrid Event (Priority: P1)

A moderator creates an event and gets a QR code and a link to a screen that can be
projected for the room. People in the room scan the QR code, and people joining
remotely open the link; each types a display name and starts chatting — sending
messages, seeing everyone else's messages (whether they're in the room or remote),
and replying to specific messages. The projected screen shows the same chat the
room and remote participants see.

**Why this priority**: This is the core of the product. Without a shared, synchronized
chat that both the room and remote participants can see and use, there is no hybrid-event
experience — nothing else in this feature is useful on its own.

**Independent Test**: Can be fully tested by creating an event, joining it from two
separate devices (simulating "in room" and "remote") plus the projected screen view,
and confirming a message sent from either device appears, in order, on the other
device and on the screen within a few seconds — with no accounts and no app install.

**Acceptance Scenarios**:

1. **Given** a moderator has created an event, **When** they open the event's setup
   view, **Then** they receive a QR code and a separate link intended for a projected
   screen, both tied to that specific event.
2. **Given** a participant scans the event QR code or opens the event link, **When**
   they enter a display name, **Then** they can immediately see the current chat and
   send messages, without creating an account or logging in.
3. **Given** two participants are in the same event (one "in the room," one "remote"),
   **When** one sends a message, **Then** the other participant and the projected
   screen view all show that message within a few seconds, in the same order.
4. **Given** a participant is viewing the chat, **When** they reply to a specific
   earlier message, **Then** their reply visibly shows which message it is answering,
   for every viewer including the projected screen.
5. **Given** a participant is composing a message, **When** they add an emoji,
   **Then** the emoji is sent and displayed normally as part of the message.
6. **Given** the moderator has already ended the event, **When** someone opens that
   event's QR code or link, **Then** they see a clear "this event has ended" message
   and cannot join, view, or post to the chat as if it were still live.
7. **Given** a participant previously sent a message, **When** they delete it,
   **Then** it no longer appears in the chat or the projected screen for anyone.

---

### User Story 2 - Moderated, Safe Chat (Priority: P2)

Because the chat is shown to a live audience and projected in the room, messages
that match an entry on the moderator's block-list of terms/phrases are held back for
the moderator to review, instead of appearing immediately. The moderator sees a
queue of held messages and approves or rejects each one; everyone else only ever
sees messages the moderator allowed through (or that didn't match the block-list at
all). The moderator maintains the block-list itself from the panel.

**Why this priority**: Builds directly on Story 1. The product cannot be safely run in
front of a real, partly-anonymous-feeling audience without this — but the plain chat
from Story 1 is still independently demonstrable/testable without it.

**Independent Test**: Can be tested by adding a term to the block-list, sending a
message containing it, and confirming the message does not reach the projected
screen or other participants until a moderator explicitly approves it, while a
message containing no block-listed term is shown immediately.

**Acceptance Scenarios**:

1. **Given** a participant sends a message that matches no block-list entry,
   **When** it is submitted, **Then** it appears immediately to all participants and
   the projected screen, with no moderator action needed.
2. **Given** a participant sends a message that matches a block-list entry, **When**
   it is submitted, **Then** it does not appear to other participants or the
   projected screen, and the sender sees their own message marked as awaiting
   approval rather than sent-and-visible or silently dropped.
3. **Given** a message is awaiting approval, **When** the moderator approves it,
   **Then** it becomes visible to all participants and the projected screen, in its
   original chronological position relative to other visible messages.
4. **Given** a message is awaiting approval, **When** the moderator rejects it,
   **Then** it never becomes visible to anyone other than the moderator, and the
   sender sees that their message was not approved.
5. **Given** several messages are awaiting approval at once, **When** the moderator
   opens the moderation queue, **Then** they can review and decide on each one
   individually.
6. **Given** the moderator is managing the block-list, **When** they add or remove a
   term/phrase, **Then** the change applies to messages sent from then on (not
   retroactively re-evaluating already-sent messages).

---

### User Story 3 - Live Polls With Shared Highlighting (Priority: P3)

During the event, the moderator can launch a poll with a question and a few answer
options. While the poll is active, every view — the participants' phones/desktops and
the projected screen — visibly highlights that a poll is happening right now. Each
participant can vote once. For each poll, the moderator decides in advance whether
results are visible as votes come in, or only revealed once the moderator chooses to.

**Why this priority**: A distinct, independently valuable slice of audience interaction
beyond free-text chat, but the product is already useful with chat alone (Stories 1–2).

**Independent Test**: Can be tested by starting a poll, voting from a participant
view, and confirming the active-poll highlight appears on both a participant view and
the projected screen, that a second vote from the same participant is rejected, and
that results behave according to the chosen reveal mode.

**Acceptance Scenarios**:

1. **Given** the moderator creates a poll with a question and between 2 and 6 answer
   options, **When** they start it, **Then** the poll becomes active for the event and
   is visibly highlighted on every participant's view and the projected screen.
2. **Given** an active poll, **When** a participant selects an option, **Then** their
   vote is recorded and they cannot vote again on that same poll.
3. **Given** the moderator chose "live results" for a poll, **When** votes come in,
   **Then** the current result breakdown updates visibly while the poll is still active.
4. **Given** the moderator chose "reveal at the end" for a poll, **When** votes come
   in, **Then** no result breakdown is shown to participants or the projected screen
   until the moderator reveals it.
5. **Given** an active poll, **When** the moderator ends it, **Then** no further votes
   are accepted and the highlighted/active state is cleared from all views.

---

### User Story 4 - Export Event Chat (Priority: P4)

The moderator can export an event's full chat transcript to a CSV file at any time —
during the event or after it ends — so they have a complete record outside the live
panel without having to manually copy messages one by one.

**Why this priority**: A straightforward data-access convenience layered on top of
Stories 1–3; valuable for record-keeping and follow-up, but nothing else depends on it.

**Independent Test**: Can be tested by sending several messages (including a reply
and a moderator-approved previously-held message) in an event, then exporting its
chat and confirming the CSV contains exactly those visible messages, with sender,
content, and timestamp, and nothing from any other event.

**Acceptance Scenarios**:

1. **Given** an event with chat history, **When** the moderator requests an export,
   **Then** they receive a CSV file containing that event's visible messages, each
   with its sender display name, content, and sent time, in chronological order.
2. **Given** an event that has not yet ended, **When** the moderator exports its
   chat, **Then** the export reflects the messages visible at that moment (export is
   not limited to ended events).
3. **Given** multiple events exist, **When** the moderator exports one event's chat,
   **Then** the file contains only that event's messages, never another event's.
4. **Given** a message was deleted by its author or rejected by the moderator,
   **When** the chat is exported, **Then** that message does not appear in the export.

### Edge Cases

- What happens when a participant's connection drops and they rejoin the event? They
  should be able to rejoin (same or new display name) and see the current chat state;
  messages already sent are not lost.
- What happens when two participants choose the same display name? Both are allowed to
  proceed; display names are for identification in context, not guaranteed-unique
  identity.
- What happens if the moderator has not reviewed the held-message queue for a while?
  Held messages continue to wait for an explicit moderator decision; none are
  auto-approved or auto-rejected after a timeout.
- What happens if someone tries to start a second poll while one is already active?
  Only one poll can be active for an event at a time; a new poll cannot start until the
  active one ends.
- What happens at or near the ~150-participant target capacity? The event continues to
  function for chat, replies, and voting without visible delay or message loss up to
  that target.
- What happens to messages that are still awaiting moderator approval when the event
  ends? They are not published to the chat as visible messages (and so are also
  excluded from any chat export).
- What happens when someone opens an event's QR code or link after the moderator has
  already ended it? They are blocked with a clear "this event has ended" message
  instead of being able to join, view, or post (resolved — see Clarifications).
- What happens when a participant sends messages faster than the rate limit allows?
  The excess messages are rejected (not queued or silently dropped later) with
  feedback to that participant, while everyone else's view is unaffected.
- What happens to a reply when the original message it replies to is deleted? The
  reply remains visible, but the reference it shows is replaced with a generic
  "original message deleted" indicator instead of the removed content.
- What happens when the moderator changes the block-list while the event is live?
  The new list applies to messages sent from that point on; messages already sent
  and already shown are not retroactively re-evaluated or hidden.
- What happens if a block-list term is extremely short or common (e.g., matches part
  of many ordinary words)? The moderator is responsible for curating a list that
  doesn't produce excessive false positives; the system matches exactly what's
  entered and does not attempt to guess intent.

## Requirements *(mandatory)*

### Functional Requirements

**Event setup & access**

- **FR-001**: System MUST let the moderator create an event with a name, and generate,
  for that event, a scannable QR code and a separate link intended for a projected
  screen.
- **FR-002**: System MUST provide a projected-screen view of an event's chat (and any
  active poll) that requires no login and is intended for display on a shared screen.
- **FR-003**: System MUST let participants join an event, from desktop or mobile, by
  scanning its QR code or opening its link, without creating an account, at any point
  from the event's creation up until the moderator ends it — there is no separate
  "not started yet" state that blocks joining or posting.
- **FR-004**: System MUST require a participant to provide a display name before
  posting to the chat; posting without identifying with a name MUST NOT be allowed.
- **FR-005**: System MUST support at least 150 participants simultaneously active in a
  single event without degrading the chat or polling experience.

**Chat**

- **FR-006**: Participants MUST be able to send text messages, including emoji, to the
  event's shared chat.
- **FR-007**: Participants MUST be able to reply to a specific earlier message, with
  the reply visibly referencing that original message to every viewer.
- **FR-008**: All participants (in-room and remote) and the projected screen MUST see
  the same chat feed, with new messages reflected on every view within a few seconds.
- **FR-009**: System MUST preserve a consistent chronological order of visible messages
  across the chat and the projected screen.
- **FR-034**: System MUST limit how many messages a single participant can send within
  a short time window, to prevent one participant from flooding the chat and projected
  screen, without the limit being so strict that it interrupts normal conversation
  pace.
- **FR-035**: A participant MUST be able to delete their own previously sent message;
  once deleted, it MUST no longer be visible on the chat or the projected screen to
  anyone (content editing after sending is not supported — only deletion).

**Moderation**

- **FR-010**: System MUST check each incoming message against the moderator's
  block-list of terms/phrases before it becomes visible to anyone other than its
  author.
- **FR-011**: System MUST hold any message matching a block-list entry pending a
  moderator decision, while messages matching no entry remain visible immediately.
- **FR-012**: The author of a held message MUST see a distinct "awaiting approval"
  status for it, rather than it appearing already visible or silently missing.
- **FR-013**: The moderator MUST be able to view all currently held messages and
  individually approve or reject each one.
- **FR-014**: An approved held message MUST become visible to all participants and the
  projected screen; a rejected message MUST NOT become visible to anyone but the
  moderator.
- **FR-015**: The moderator MUST be able to add and remove block-list terms/phrases at
  any time, in any language, since message content is not restricted to one language;
  changes apply only to messages sent after the change (per Edge Cases).

**Polls**

- **FR-016**: The moderator MUST be able to create a poll with a question and between 2
  and 6 answer options, and start it as the active poll for the current event.
- **FR-017**: System MUST allow at most one active poll per event at a time.
- **FR-018**: Each participant MUST be limited to one vote per poll.
- **FR-019**: While a poll is active, every participant view and the projected screen
  MUST visibly indicate that a poll is in progress.
- **FR-020**: The moderator MUST be able to set, per poll, whether results are visible
  as votes arrive ("live") or hidden until the moderator reveals them.
- **FR-021**: The moderator MUST be able to end the active poll, after which no further
  votes are accepted for it and the active/highlighted state clears.

**Event lifecycle & export**

- **FR-027**: The moderator MUST be able to end an event, after which no further
  messages or votes are accepted for it.
- **FR-032**: Once an event has ended, opening its QR code or link MUST be blocked
  with a clear message that the event has ended, rather than allowing someone to join,
  view, or post as if it were still live.
- **FR-028**: The moderator MUST be able to export an event's full chat transcript
  (visible messages only — not held, rejected, or deleted ones) as a CSV file, at any
  time, whether the event has ended or is still live.
- **FR-030**: System MUST keep each event's chat, poll, and participant data scoped to
  that event, so one event's export never mixes in another event's data.

**Reliability**

- **FR-033**: When a participant's device reconnects after losing connectivity
  (whether due to their own network or a brief backend interruption), it MUST
  automatically catch up on messages, poll state, and moderation status sent while it
  was disconnected, without the participant needing to manually refresh or re-join.

**Accessibility**

- **FR-036**: The participant view and the moderator panel MUST be usable via keyboard
  navigation and compatible with screen readers; the projected-screen view is
  view-only and is exempt from this requirement.

**Access**

- **FR-031**: Access to the moderator's panel (creating events, moderating, running
  polls, managing the block-list, and exporting chat) MUST require moderator
  authentication; participant and projected-screen views MUST NOT require
  authentication.

### Key Entities

- **Event**: A single occurrence of a hybrid session (e.g., one podcast taping or
  meetup). Has a name, a lifecycle status (not yet started / live / ended), a QR
  code and projected-screen link, and timestamps for when it started and ended.
- **Participant**: A person taking part in one event, identified only by the display
  name they entered for that event. Not a persistent account; not guaranteed unique.
- **Message**: A chat entry from a participant: its text/emoji content, which event it
  belongs to, an optional reference to the message it replies to, when it was sent,
  its moderation status (visible, awaiting approval, or rejected), and whether it has
  been deleted by its author (content is never edited after sending, only deleted).
- **Poll**: A moderator-defined question with 2–6 answer options for one event, its
  lifecycle status (not started / active / ended), its results-visibility mode (live
  or reveal-at-end), and the set of participant votes cast against it (one per
  participant).
- **Block-List Entry**: A single term or phrase the moderator has added, used to flag
  matching incoming messages for approval. Belongs to the moderator's account, not to
  one event (so it carries over between events).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new participant can go from scanning the event QR code to sending
  their first chat message in under 60 seconds.
- **SC-002**: A message sent by any participant appears on the projected screen and on
  other participants' views within 3 seconds under normal event conditions.
- **SC-003**: A single event supports at least 150 concurrently active participants
  with no visible delay or message loss in chat or polling.
- **SC-004**: Messages that match no block-list entry reach other participants and the
  projected screen with no moderator action; messages that do match are reliably
  intercepted before reaching them, with zero cases of a held message becoming
  visible without an explicit moderator approval.
- **SC-005**: The moderator can resolve a held message (approve or reject) in a single
  action from the moderation queue.
- **SC-006**: A participant can cast a poll vote in a single action, and, when the poll
  is set to live results, the visible result breakdown updates within a few seconds of
  votes being cast.
- **SC-007**: The moderator can export an event's chat transcript in a single action,
  without manually copying or compiling messages.
- **SC-008**: A first-time moderator can create an event and obtain a usable QR code
  and projected-screen link in under 2 minutes without outside help.

## Assumptions

- Exactly one moderator account and one live event at a time are in scope for this
  feature; multiple simultaneous moderators or concurrently-live events are out of
  scope (consistent with the project's current single-admin, single-event scale).
- The product does not ingest or embed any third-party streaming platform's chat
  (e.g., YouTube, Zoom) — all chat participation happens through this product's own
  join flow regardless of which platform, if any, is streaming audio/video of the
  event.
- The moderator-facing interface copy is in English; participant-submitted message
  content is not restricted to any one language, and the moderator's block-list can
  contain terms in any language they choose to add.
- The product has no AI/LLM dependency. Message moderation is a deterministic
  block-list match the moderator curates themselves; there is no automatic
  understanding of intent, sarcasm, or context, and no topic/question clustering or
  AI-generated analysis of any kind.
- Display names are not verified or guaranteed unique; they exist to let participants
  and the moderator tell speakers apart in context, not as an identity system.
- Data for an event (chat, poll results) is retained at least until the moderator has
  had the chance to export it; a specific deletion policy beyond that point is not
  defined by this feature and is left for later work.
- No formal uptime/availability target is set for the real-time backend itself in this
  feature; resilience relies on whichever managed real-time service is chosen during
  planning, plus the client-side automatic reconnect-and-catch-up behavior (FR-033).
- The exact per-participant rate limit (FR-034) is an implementation judgment call,
  bounded only by "stops flooding without disrupting normal conversation" — no
  specific message-per-minute number is fixed by this spec.
- Accessibility (FR-036) is bounded to keyboard navigation and screen-reader
  compatibility for the participant and moderator views; no formal compliance level
  (e.g., WCAG AA) is set, and the projected-screen view is exempt since it is
  view-only.
