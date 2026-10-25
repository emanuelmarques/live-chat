# Contract: Moderator Auth (`convex/auth.ts`)

| Function | Type | Args | Returns | Satisfies |
|---|---|---|---|---|
| `login` | mutation | `{ email: string; password: string }` | `{ sessionToken: string }` | FR-031 |
| `getSession` | query | `{ sessionToken: string }` | `{ moderatorId: Id<"moderators"> } \| null` | Gate for every other moderator-only function below |

**Convention**: every mutation/query in `events.ts`, `moderation.ts`, `polls.ts`,
`insights.ts`, and `reports.ts` marked "moderator-only" takes a `sessionToken` and
calls `getSession`-equivalent server-side logic before proceeding; participant- and
projector-facing functions (`participants.ts`, `messages.ts` reads, `getJoinInfo`)
take no session and require no authentication (FR-031).
