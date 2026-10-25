# Contract: Polls (`convex/polls.ts`)

| Function | Type | Args | Returns | Satisfies |
|---|---|---|---|---|
| `createAndStartPoll` | mutation (moderator-only) | `{ eventId, question: string, options: string[] (2–6), revealMode: "live" \| "atEnd" }` | `{ pollId: Id<"polls"> }` | FR-016, FR-020; rejects if `eventId.activePollId` is already set (FR-017) |
| `castVote` | mutation | `{ pollId: Id<"polls">; participantId: Id<"participants">; optionIndex: number }` | `{}` | FR-018; rejects on a second vote from the same participant, or on a poll that has ended |
| `getActivePoll` | query (reactive) | `{ eventId: Id<"events"> }` | `{ pollId, question, options, revealMode, isActive: boolean, resultsVisible: boolean, counts?: number[] }[0 or 1]` | FR-019 — returns the event's current *or most-recently-ended* poll (not only while active), since an `atEnd` poll's final results must stay readable after `endPoll` clears `events.activePollId`; `isActive` is the "poll in progress" highlight signal. `resultsVisible` is `true` for `revealMode: "live"`, once the moderator calls `revealResults`, or once the poll has ended (reveal "at the end" happening literally at the end); `counts` is only present when `resultsVisible` is true |
| `revealResults` | mutation (moderator-only) | `{ pollId: Id<"polls"> }` | `{}` | FR-020 (for `revealMode: "atEnd"` polls; manual early reveal) |
| `endPoll` | mutation (moderator-only) | `{ pollId: Id<"polls"> }` | `{}` | FR-021 — sets `status: "ended"`, clears the event's `activePollId` |

**Highlighting**: the participant and projector clients both subscribe to
`getActivePoll`; its presence/absence is exactly the "poll in progress" highlight
signal referenced by FR-019 and User Story 3's acceptance scenarios.
