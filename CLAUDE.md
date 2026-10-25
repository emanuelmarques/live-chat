# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This repository has no application source code yet. It currently contains only the
[GitHub Spec Kit](https://github.com/github/spec-kit) spec-driven-development (SDD)
scaffolding (`.specify/`, `.claude/skills/speckit-*`) and the project constitution. The
product itself — a real-time chat/polling app for hybrid (in-person + remote) events,
with a projector view, participant mobile view, and a moderator panel — exists so far
only as a specification-in-progress, not as code.

Before writing any implementation plan or code, read `.specify/memory/constitution.md`.
It defines binding constraints for this project: target scale (~100–150 concurrent
participants, one event, one moderator), required consistency across the
projector/mobile/moderator surfaces, test-first requirements for poll tallying and
the moderation state machine, minimal named (no-login, no-anonymous) participant
data, and that automated checks only flag/suggest while the moderator always has
final say. As of v1.1.0, the project has no AI/LLM dependency: moderation uses a
moderator-managed block-list, not a model, and there is no topic/question
clustering or AI-generated report (see `specs/001-hybrid-event-chat/spec.md`'s
Clarifications → "Amendment 2026-10-24"). Any plan or task that would expand scope
beyond that (multi-tenant, multi-admin, direct integration with a streaming
platform's native chat, reintroducing an AI dependency) must call out and justify
the deviation explicitly rather than drift into it.

## Spec Kit workflow

This project is developed via Spec Kit's slash commands, in this order, each
building on the previous command's output under `specs/<feature>/`:

1. `/speckit-specify` — turn a feature description into `spec.md`.
2. `/speckit-clarify` — resolve underspecified areas in `spec.md` (run before `/speckit-plan` unless the user explicitly skips it).
3. `/speckit-plan` — generate the implementation plan and design artifacts from `spec.md`, gated by the constitution.
4. `/speckit-tasks` — generate dependency-ordered `tasks.md` from the plan.
5. `/speckit-analyze` — cross-check `spec.md`/`plan.md`/`tasks.md` for consistency (non-destructive, read-only).
6. `/speckit-checklist` — generate a custom review checklist for the feature on request.
7. `/speckit-implement` — execute `tasks.md`.
8. `/speckit-converge` — after implementation, diff the actual codebase against spec/plan/tasks and append any unbuilt work as new tasks.
9. `/speckit-taskstoissues` — convert `tasks.md` into GitHub issues, if the user wants issue tracking instead of/alongside local execution.

`/speckit-constitution` only edits `.specify/memory/constitution.md` itself — it does
not implement features and should not be used for anything else.

PowerShell is the scripting backend for this project (`.specify/scripts/powershell/`,
`init-options.json` has `"script": "ps"`) — Spec Kit commands invoke those `.ps1`
scripts, not the bash equivalents.

## Build, lint, and test commands

Stack: TypeScript, React + Vite frontend, [Convex](https://convex.dev) backend
(reactive datastore + serverless functions). No AI/LLM dependency (constitution
v1.1.0) — see `specs/001-hybrid-event-chat/spec.md`'s Clarifications.

```bash
npm install
npx convex dev        # keep running — provisions/links the dev deployment, codegen
npm run dev            # keep running — Vite dev server

npm run typecheck       # tsc --noEmit across src/, convex/, e2e/, tests/
npm run lint             # eslint .
npm run test:unit          # Vitest — frontend unit/component tests (src/**/*.test.tsx)
npm run test:convex         # Vitest + convex-test — backend contract tests (tests/convex/)
npm run test:e2e              # Playwright — starts its own Convex + Vite servers
```

A single backend test file: `npx vitest run --config vitest.convex.config.ts tests/convex/polls.test.ts`.
A single e2e spec: `npx playwright test e2e/polls.spec.ts`.

Backend test files **must** live under `tests/convex/`, never under `convex/`
itself: Convex's push step bundles every file under `convex/` as a candidate
function, and chokes on `import.meta.glob` (which `convex-test`'s module loader
needs) — see `plan.md`'s Project Structure note.

There is exactly one moderator account for the life of this project (Principle I);
`convex/auth.ts`'s `bootstrapModerator` mutation creates it once and throws on every
later call — tests and scripts that call it must swallow that error rather than
treating it as a failure.
