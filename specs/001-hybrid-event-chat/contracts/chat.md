# Contract: Chat (`convex/participants.ts`, `convex/messages.ts`)

| Function | Type | Args | Returns | Satisfies |
|---|---|---|---|---|
| `joinEvent` | mutation | `{ eventId: Id<"events">; displayName: string }` | `{ participantId: Id<"participants"> }` | FR-003, FR-004 |
| `sendMessage` | mutation | `{ eventId, participantId, content: string, replyToMessageId?: Id<"messages"> }` | `{ messageId: Id<"messages"> }` | FR-006, FR-007; enforces the rate limit (FR-034) by rejecting with a specific error when exceeded; checks `content` against the moderator's `blockListEntries` (synchronously, in-mutation — see `moderation.md`) and writes `moderationStatus: "pending"` on a match, `"visible"` otherwise; never writes `"rejected"` directly |
| `deleteMessage` | mutation | `{ messageId: Id<"messages">; participantId: Id<"participants"> }` | `{}` | FR-035 — only the original author may delete; sets `deletedAt` |
| `listMessages` | query (reactive, paginated) | `{ eventId: Id<"events">, paginationOpts }` | a pagination result whose `page` is `{ messageId, authorKey, authorDisplayName, content, replyTo: { messageId, deleted: boolean, authorDisplayName?, content? } | null, sentAt }[]`, **newest first** | FR-008, FR-009 — returns only `visible`, non-deleted messages; a page is at most 100 items whatever the client asks. Clients load the newest page and fetch older ones on scroll (`usePaginatedQuery`), reversing for display. A message replying to a deleted one still appears with `replyTo.deleted = true` (Edge Cases); a quoted original on an older page is looked up directly. `authorKey` is an opaque public id (never the participant's credential) that lets a client recognise its own messages |
| `listMessageReactions` | query (reactive) | `{ eventId, since: number }` | `Record<messageId, { emoji, count }[]>` | Reaction counts for messages sent at or after `since` (the oldest loaded message), so a reaction re-sends only this small result, not the message texts. Never exposes who reacted |
| `listMyMessageReactions` | query (reactive) | `{ eventId, participantId }` | `{ messageId, emoji }[]` | The viewer's own reactions, to highlight their chips; changes only when they react |

**Rate limit error**: `sendMessage` throws a typed `RateLimited` error (not a silent
no-op) when the participant is over the limit, so the client can show feedback
without affecting any other participant's view (Edge Cases).

**Reconnect/catch-up**: no explicit function — `listMessages` being a reactive query
means a reconnecting client automatically receives the current state of every page it has loaded (FR-033),
per `research.md`.

**Own pending/rejected status** (added during US2 implementation — see
`moderation.md`): `listOwnPendingOrRejected({ eventId, participantId })` is a
reactive query returning only the calling participant's own `pending`/`rejected`
messages, so their client can render "awaiting approval" (FR-012) without exposing
that status to anyone else.
