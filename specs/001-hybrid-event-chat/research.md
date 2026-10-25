# Phase 0 Research: Hybrid Event Live Chat

> **Amendment (2026-10-24)**: the original version of this document included an "AI
> provider & usage pattern" entry (Claude, for moderation flagging, topic/question
> clustering, and report generation). The project owner decided against an AI/LLM
> dependency before any code was written (see `spec.md`'s Clarifications →
> "Amendment 2026-10-24"). That entry is replaced below with "Content moderation
> approach" (a block-list match) and "Chat export," and the clustering/report
> call-sites no longer exist.

All Technical Context choices were made directly from the constitution's explicit
Technology & Scale Constraints (TypeScript, responsive web, managed real-time service,
no AI/LLM dependency, managed hosting, ~150-participant single-event scale) rather
than left open, so there are no unresolved `NEEDS CLARIFICATION` markers. Each entry
below records the decision, why it fits this project specifically, and what was
considered instead.

## Frontend framework

- **Decision**: React 18 + Vite + TypeScript.
- **Rationale**: Convex (the chosen backend) ships first-class React hooks
  (`useQuery`/`useMutation`) with automatic reactive re-rendering, which is the
  simplest path to Principle III (live consistency across surfaces) — no manual
  subscription/polling code. Vite gives fast local dev and a static production build
  that deploys to any static host.
- **Alternatives considered**: Next.js (rejected — its server-rendering/routing
  machinery is unneeded complexity for a client-rendered, Convex-backed app at this
  scale, conflicting with Principle I); Svelte/Vue (rejected — smaller ecosystem
  overlap with Convex's official bindings, no material benefit here).

## Backend & real-time datastore

- **Decision**: Convex.
- **Rationale**: Convex is a managed, serverless, TypeScript-native backend whose
  queries are reactive by default — every subscribed client (participant view,
  projector, moderator panel) is pushed updates automatically, which is exactly
  Principle III's requirement. There is no server to provision, patch, or scale for
  ~150 concurrent users, matching Principle I and the constitution's "managed
  real-time service, not a self-managed realtime server."
- **Alternatives considered**: Firebase/Firestore + Cloud Functions (viable, but
  real-time listeners and function triggers need more manual wiring to get the same
  reactive-everywhere behavior Convex gives by default); Supabase/Postgres + Realtime
  (viable, but its real-time layer is opt-in per table/channel rather than the
  default query model, and the project doesn't need relational joins complex enough
  to justify Postgres); a self-hosted WebSocket server (rejected outright — directly
  conflicts with "no self-managed realtime server").

## Hosting

- **Decision**: Vercel for the static frontend build; Convex Cloud for the backend
  (Convex's own managed hosting, provisioned via the Convex CLI).
- **Rationale**: Both are managed platforms with no server maintenance, sized
  naturally for one small app — satisfies the constitution's hosting constraint
  directly. Convex Cloud is the only hosting target for a Convex backend, so this
  isn't a separate choice so much as a consequence of picking Convex.
- **Alternatives considered**: Netlify/Cloudflare Pages for the frontend (equally
  valid; Vercel chosen for its default Vite support and zero-config preview
  deployments, not a hard requirement).

## Content moderation approach

- **Decision**: A moderator-managed block-list of terms/phrases, matched
  synchronously inside the `sendMessage` mutation itself — no external call, no AI
  provider.
- **Rationale**: The project owner decided against an AI/LLM dependency. A
  block-list is deterministic, instant (no latency/availability failure mode to
  design around, unlike an external API call), fully auditable (the moderator
  wrote every entry), and sufficient for FR-010/FR-011's "flag, don't auto-remove"
  requirement — the match result can only route a message to `pending`, the same as
  the original design, just via simple text matching instead of classification.
- **Matching**: case-insensitive substring/whole-word match against the current
  `blockListEntries` for the moderator's account (entries aren't per-event, per
  spec's Key Entities, so they carry over between events). Entries can be added in
  any language (FR-015); there is no language-specific logic to build, since this
  isn't NLU — it's string matching.
- **Alternatives considered**: a hosted moderation API (e.g., a dedicated
  text-moderation endpoint) — rejected, same reason as Claude: no AI/LLM dependency
  of any kind. A regex-based list (instead of plain substring/word match) — left as
  an implementation detail; plain matching is the simpler default and sufficient for
  v1's explicit scope.

## Chat export

- **Decision**: A Convex query (`export.ts`'s `exportChatCsv`) that reads an
  event's currently-visible messages and returns CSV text directly to the client,
  which triggers a browser download — no server-persisted report file, no AI
  summarization.
- **Rationale**: The feature is now explicitly "export the chat to a CSV," not an
  analyzed report — so there's nothing to generate ahead of time or store. Building
  the CSV on demand from `messages` keeps there being a single source of truth (no
  separate `eventReports` table to keep in sync).
- **Alternatives considered**: generating and storing a CSV file (e.g., in a file
  storage bucket) at `endEvent` — rejected as unneeded: FR-028 allows exporting a
  live, not-yet-ended event too, so there's no single "generation" moment to hook
  into, and on-demand generation is cheap at this message volume.

## Testing stack

- **Decision**: Vitest + Testing Library for frontend unit/component tests;
  `convex-test` for Convex function unit/contract tests; Playwright for end-to-end
  multi-client scenarios and accessibility smoke checks (via `@axe-core/playwright`).
- **Rationale**: Vitest and `convex-test` are the stack's own TypeScript-native test
  runners (Vitest config is shared), keeping the toolchain small per Principle I.
  Playwright is the only practical way to assert Principle III's cross-surface
  behavior (e.g., a message sent from a simulated "remote" browser context appears
  in a simulated "projector" context within the target delay) and to run automated
  keyboard-navigation/screen-reader-tree checks for FR-036.
- **Alternatives considered**: Jest (rejected — Vitest is the natural fit for a
  Vite project, avoids a second, differently-configured runner); Cypress (rejected
  — weaker true multi-browser-context support for the simultaneous-viewers
  scenarios this feature specifically needs to test).

## QR code generation

- **Decision**: Generate the QR code client-side, in the moderator's event-setup
  view, from the event's join URL using a small QR-encoding library (e.g. `qrcode`)
  rendered to an `<svg>`/canvas.
- **Rationale**: The QR code only encodes a URL the app already knows (the join
  link) — there's no need for a server round-trip or stored image asset. Client-side
  generation keeps `convex/events.ts` focused on data, not image rendering.
- **Alternatives considered**: Server-generated QR image (via a Convex action
  returning a data URL) — rejected as unnecessary indirection for a value derivable
  entirely from data the client already has.

## Rate limiting (FR-034)

- **Decision**: A per-participant sliding-window counter checked inside the
  `sendMessage` mutation itself (e.g., reject if the participant has sent more than
  N messages in the last T seconds), backed by a small per-participant counter
  record in Convex — no external rate-limiting service.
- **Rationale**: At ~150 participants and modest message volume, an in-mutation
  check is simplest (Principle I) and keeps the limit transactionally consistent
  with the send itself (no race between a separate limiter service and the write).
- **Alternatives considered**: A dedicated rate-limiting service/middleware
  (rejected — unneeded infrastructure at this scale).

## Reconnect & catch-up behavior (FR-033)

- **Decision**: Rely on Convex client's built-in reactive-query reconnection: when a
  client's WebSocket drops and reconnects, Convex automatically re-syncs every active
  query subscription to current state. No bespoke "catch-up" protocol is needed.
- **Rationale**: This is a built-in property of the chosen backend, not something to
  build — confirms FR-033 is satisfied by the architecture choice itself rather than
  needing separate implementation.

## Accessibility approach (FR-036)

- **Decision**: Semantic HTML landmarks and controls throughout the participant and
  moderator views (buttons/links as real `<button>`/`<a>`, form labels on inputs),
  an `aria-live="polite"` region for the incoming chat feed so screen readers
  announce new messages without interrupting, and full keyboard operability
  (tab order, visible focus states, no click-only controls) for composing, replying,
  deleting, voting, and every moderator action. The projected-screen view is exempt
  (FR-036) and is not held to this bar.
- **Rationale**: Matches the clarified scope — keyboard + screen-reader
  compatibility, no formal WCAG level — with well-understood, low-overhead patterns
  rather than a heavier audit framework.
- **Alternatives considered**: Adopting a full WCAG 2.1 AA audit process (rejected
  — explicitly out of scope per the Clarifications session).
