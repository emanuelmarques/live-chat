# Contract: Chat Export (`convex/export.ts`)

> **Amendment (2026-10-24)**: replaces `contracts/reports.md` (AI-generated
> post-event report) and `contracts/insights.md` (live topic/question clustering,
> removed entirely). See `spec.md`'s Clarifications → "Amendment 2026-10-24."

| Function | Type | Args | Returns | Satisfies |
|---|---|---|---|---|
| `exportChatCsv` | query (moderator-only) | `{ eventId: Id<"events"> }` | `{ csv: string }` | FR-028 — CSV text with one row per currently-visible, non-deleted message (sender display name, content, sent time), in chronological order, scoped to exactly that event (FR-030) |

**Availability**: unlike the removed report, this works on a live (not-yet-ended)
event too — US4's acceptance scenarios explicitly require that (FR-028 says "at any
time, whether the event has ended or is still live").

**Content scope**: only messages with `moderationStatus: "visible"` and no
`deletedAt` are included — held, rejected, and deleted messages are excluded (per
spec's Edge Cases and User Story 4's acceptance scenario 4).

**Delivery**: the query returns CSV as a string; the client triggers a browser
download (e.g., via a `Blob` + anchor click) — no server-side file storage is
involved.
