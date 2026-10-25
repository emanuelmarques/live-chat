# Phase 1 Data Model: Hybrid Event Live Chat

Entities below map directly to the spec's Key Entities section, expressed as Convex
tables. Types are TypeScript/Convex-flavored (`Id<"table">` is Convex's typed
document reference); this is a design artifact, not the literal `schema.ts` source.

> **Amendment (2026-10-24)**: the AI/LLM dependency was removed before any code was
> written (see `spec.md`'s Clarifications and `plan.md`'s Amendment note). The
> `insightGroups` and `eventReports` tables from the original version of this
> document are gone; see `blockListEntries` below for what replaced moderation's
> AI-flagging data, and the Relationships section for the chat export's (now
> un-stored) shape.

## `events`

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | Set at creation (FR-001) |
| `status` | `"active" \| "ended"` | No separate "not started" state (Clarifications) |
| `joinSlug` | `string`, unique | Short token encoded in the QR code / join link |
| `createdAt` | `number` (ms epoch) | |
| `endedAt` | `number \| null` | Set once, by `endEvent` (FR-027) |
| `activePollId` | `Id<"polls"> \| null` | Enforces "at most one active poll" (FR-017) |

**Lifecycle**: `active` → `ended` (one-way; `ended` is terminal — FR-027, FR-032).

## `moderators`

| Field | Type | Notes |
|---|---|---|
| `email` | `string`, unique | Login identifier |
| `passwordHash` | `string` | Never store plaintext |
| `createdAt` | `number` | |

**Note**: Exactly one row exists for v1 (constitution Principle I: single-admin
scope). The table exists as its own entity — rather than a hardcoded credential —
so adding a second moderator later is a data change, not a schema migration; no
roles/permissions logic is built now (that would be scope the constitution excludes
until it's actually needed).

## `participants`

| Field | Type | Notes |
|---|---|---|
| `eventId` | `Id<"events">` | Scopes the participant to one event (FR-030) |
| `displayName` | `string` | Required before posting (FR-004); not unique (Edge Cases) |
| `joinedAt` | `number` | |

**Note**: No credentials. A participant's identity for the rest of their session is
held client-side (e.g., a locally-stored participant id) and re-sent on reconnect —
there is nothing server-side to "log into."

## `messages`

| Field | Type | Notes |
|---|---|---|
| `eventId` | `Id<"events">` | |
| `participantId` | `Id<"participants">` | |
| `authorDisplayName` | `string` | Snapshot at send time |
| `content` | `string` | Text, may include emoji (FR-006) |
| `replyToMessageId` | `Id<"messages"> \| null` | FR-007 |
| `sentAt` | `number` | Ordering key (FR-009) |
| `moderationStatus` | `"visible" \| "pending" \| "rejected"` | FR-010–FR-014 |
| `deletedAt` | `number \| null` | Set by the author's own delete (FR-035) |

**Lifecycle**: `pending` → `visible` (moderator approve) or `pending` → `rejected`
(moderator reject); `visible` → soft-deleted via `deletedAt` (author only, FR-035).
`rejected` and soft-deleted are terminal — never shown regardless of other state.

**Validation**: `content` non-empty; a reasonable maximum length is an
implementation detail (not fixed by the spec). A message with `replyToMessageId`
pointing at a now-deleted message still renders, with the reference shown as
"original message deleted" (Edge Cases) rather than the original content.

## `polls`

| Field | Type | Notes |
|---|---|---|
| `eventId` | `Id<"events">` | |
| `question` | `string` | |
| `options` | `string[]`, length 2–6 | FR-016 |
| `revealMode` | `"live" \| "atEnd"` | Set per-poll by the moderator, FR-020 |
| `status` | `"active" \| "ended"` | |
| `resultsRevealed` | `boolean` | Set `true` by a moderator's early `revealResults` call on an `atEnd` poll (FR-020) |
| `startedAt` | `number` | |
| `endedAt` | `number \| null` | |

**Lifecycle**: `active` → `ended` (one-way, FR-021). `events.activePollId` is
cleared when a poll ends. Results are visible (`resultsVisible`, computed, not
stored) when `revealMode === "live"`, OR `resultsRevealed === true` (moderator
revealed early), OR `status === "ended"` (an `atEnd` poll's results surface once
the poll has actually ended, matching "reveal at the end" literally).

## `pollVotes`

| Field | Type | Notes |
|---|---|---|
| `pollId` | `Id<"polls">` | |
| `participantId` | `Id<"participants">` | |
| `optionIndex` | `number` | Index into the poll's `options` |
| `votedAt` | `number` | |

**Validation**: unique on `(pollId, participantId)` — enforces one vote per
participant per poll (FR-018).

## `blockListEntries`

> **Amendment (2026-10-24)**: replaces the original `insightGroups` and
> `eventReports` tables, which depended on the now-removed AI/LLM dependency (see
> `spec.md`'s Clarifications → "Amendment 2026-10-24"). There is no stored report —
> the chat export (FR-028) is computed on demand from `messages`, not persisted.

| Field | Type | Notes |
|---|---|---|
| `moderatorId` | `Id<"moderators">` | Belongs to the moderator's account, not one event (spec Key Entities) |
| `term` | `string` | Matched case-insensitively against message content (FR-010, FR-015) |
| `addedAt` | `number` | |

**Note**: No `eventId` — entries carry over between events, per spec. Matching
(substring vs. whole-word) is an implementation detail left to `convex/messages.ts`;
either way, a match only ever routes a message to `pending`, never directly to
`rejected` (constitution Principle V).

## Relationships

```text
events 1───* participants
events 1───* messages ──(replyToMessageId)──> messages (self-reference)
events 1───* polls 1───* pollVotes *───1 participants
moderators 1───* blockListEntries
moderators 1───1 (the single v1 account; no other table references it directly)
```

Chat export (FR-028) is a read-only projection of `messages` for one `eventId` —
not a stored entity, so it has no row in this data model.
