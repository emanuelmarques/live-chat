# Contract: Chat (`convex/participants.ts`, `convex/messages.ts`)

| Function | Type | Args | Returns | Satisfies |
|---|---|---|---|---|
| `joinEvent` | mutation | `{ eventId: Id<"events">; displayName: string }` | `{ participantId: Id<"participants"> }` | FR-003, FR-004 |
| `sendMessage` | mutation | `{ eventId, participantId, content: string, replyToMessageId?: Id<"messages"> }` | `{ messageId: Id<"messages"> }` | FR-006, FR-007; enforces the rate limit (FR-034) by rejecting with a specific error when exceeded; checks `content` against the moderator's `blockListEntries` (synchronously, in-mutation — see `moderation.md`) and writes `moderationStatus: "pending"` on a match, `"visible"` otherwise; never writes `"rejected"` directly |
| `deleteMessage` | mutation | `{ messageId: Id<"messages">; participantId: Id<"participants"> }` | `{}` | FR-035 — only the original author may delete; sets `deletedAt` |
| `listMessages` | query (reactive) | `{ eventId: Id<"events"> }` | `{ messageId, participantId, authorDisplayName, content, replyTo: { messageId, deleted: boolean } \| null, sentAt }[]` | FR-008, FR-009 — returns only `visible`, non-deleted messages, in `sentAt` order; a message replying to a deleted one still appears with `replyTo.deleted = true` instead of its content (Edge Cases). `participantId` lets the client that sent a message recognize it as its own (e.g., to show a delete control) |

**Rate limit error**: `sendMessage` throws a typed `RateLimited` error (not a silent
no-op) when the participant is over the limit, so the client can show feedback
without affecting any other participant's view (Edge Cases).

**Reconnect/catch-up**: no explicit function — `listMessages` being a reactive query
means a reconnecting client automatically receives the current full state (FR-033),
per `research.md`.

**Own pending/rejected status** (added during US2 implementation — see
`moderation.md`): `listOwnPendingOrRejected({ eventId, participantId })` is a
reactive query returning only the calling participant's own `pending`/`rejected`
messages, so their client can render "awaiting approval" (FR-012) without exposing
that status to anyone else.
