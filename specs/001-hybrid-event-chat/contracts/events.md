# Contract: Events (`convex/events.ts`)

| Function | Type | Args | Returns | Satisfies |
|---|---|---|---|---|
| `createEvent` | mutation | `{ name: string }` | `{ eventId: Id<"events">; joinSlug: string }` | FR-001 (requires moderator auth, see `auth.md`) |
| `getJoinInfo` | query | `{ joinSlug: string }` | `{ eventId: Id<"events">; name: string; status: "active" \| "ended" }` | FR-002, FR-003, FR-032 — resolves a scanned QR/link to an event and its current status, so the client can route to chat or to an "event has ended" screen |
| `getEvent` | query | `{ eventId: Id<"events"> }` | `{ name, status, activePollId, createdAt, endedAt }` | Backs the moderator panel and the projector view |
| `listEvents` | query | `{}` (moderator-only) | `{ eventId, name, status, createdAt }[]` | Moderator's event list (US4) |
| `endEvent` | mutation | `{ eventId: Id<"events"> }` (moderator-only) | `{}` | FR-027; no follow-up action — chat export (`export.exportChatCsv`) is computed on demand, not generated at end |

**Errors**: `getJoinInfo` on an unknown `joinSlug` returns a not-found result (client
shows a generic "event not found" state); it does not throw, since this is an
expected path for mistyped/stale links as well as ended events.
