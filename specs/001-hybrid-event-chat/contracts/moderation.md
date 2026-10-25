# Contract: Moderation (`convex/moderation.ts`, block-list check in `convex/messages.ts`)

> **Amendment (2026-10-24)**: replaces the original Claude-based `checkMessage`
> action. The check is now a synchronous, deterministic block-list match performed
> inline in `sendMessage` — there is no separate action, and no "AI error/timeout"
> failure mode to design around (see `research.md`).

| Function | Type | Args | Returns | Satisfies |
|---|---|---|---|---|
| `listBlockListEntries` | query (moderator-only) | `{}` | `{ entryId: Id<"blockListEntries">; term: string; addedAt: number }[]` | FR-015 |
| `addBlockListEntry` | mutation (moderator-only) | `{ term: string }` | `{ entryId: Id<"blockListEntries"> }` | FR-015 |
| `removeBlockListEntry` | mutation (moderator-only) | `{ entryId: Id<"blockListEntries"> }` | `{}` | FR-015 — affects only messages sent after removal (Edge Cases) |
| `listPending` | query (reactive, moderator-only) | `{ eventId: Id<"events"> }` | `{ messageId, authorDisplayName, content, sentAt }[]` | FR-013 |
| `approveMessage` | mutation (moderator-only) | `{ messageId: Id<"messages"> }` | `{}` | FR-013, FR-014 — sets `visible` |
| `rejectMessage` | mutation (moderator-only) | `{ messageId: Id<"messages"> }` | `{}` | FR-013, FR-014 — sets `rejected` |

**The check itself**: `messages.sendMessage` reads the current
`blockListEntries` for the moderator's account and tests `content` against each
`term` (case-insensitive match; exact matching strategy is an implementation
detail — see `research.md`). A match sets `moderationStatus: "pending"`; no match
sets `"visible"` directly. This logic never sets `"rejected"` — only
`rejectMessage`, a moderator-triggered mutation, can do that (constitution
Principle V).

**Author-visible status**: `messages.listOwnPendingOrRejected` (see `chat.md`) is a
separate reactive query scoped to the calling participant's own non-visible
messages, so the author's own client can render "awaiting approval" (FR-012) or
"not approved" while nobody else sees that status at all — `chat.md`'s
`listMessages` only ever returns `visible` messages, to everyone.
