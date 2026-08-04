# LangGraph Onboarding State Machine Specification

**Epic**: EPIC 13 — LangGraph Onboarding State Machine
**Slice**: `.specs/features/onboarding-langgraph/`
**Tasks**: [SCRUM-100](https://csai420.atlassian.net/browse/SCRUM-100) … [SCRUM-104](https://csai420.atlassian.net/browse/SCRUM-104)
**Related to**: EPIC 14 — User Registration API ([SCRUM-110](https://csai420.atlassian.net/browse/SCRUM-110)…[SCRUM-119](https://csai420.atlassian.net/browse/SCRUM-119), PR #43, unmerged) — that epic owns the final `POST /api/user/register-chat` persistence call this graph will eventually hand off to.

## Problem Statement

New-user signup today is a single form POST (`src/app/auth/signup/route.ts`). EPIC 13
introduces a conversational alternative: a LangGraph state machine that walks a
prospective user through onboarding one question at a time (name, then email, then
date of birth), validating each answer before advancing. No such graph, or any
`@langchain/langgraph` usage, exists in the repo yet — this slice builds it from
scratch for the first four conversation states.

## Goals

- [ ] Stand up a compiled LangGraph `StateGraph` for the onboarding flow (SCRUM-100)
- [ ] `GREETING` node introduces the assistant and explains the signup flow (SCRUM-101)
- [ ] `COLLECT_NAME` node prompts for and validates a full name (SCRUM-102)
- [ ] `COLLECT_EMAIL` node prompts for and validates an email address (SCRUM-103)
- [ ] `COLLECT_DOB` node prompts for and validates a date of birth (SCRUM-104)
- [ ] Each `COLLECT_*` node re-prompts on invalid input instead of advancing

## Out of Scope

| Feature | Reason |
| --- | --- |
| HTTP entry point (`POST /api/onboarding/...`) | Not requested by SCRUM-100–104; the graph is a library module in this slice, wired to a route in a follow-up ticket |
| Persistent (cross-request) checkpointing | `MemorySaver` (in-process) only; a durable checkpointer is a follow-up decision — see Assumptions |
| Password collection / final `User` creation | Owned by EPIC 14's `POST /api/user/register-chat` (PR #43, unmerged, currently a 501 stub); `COLLECT_DOB`'s success edge is a named placeholder pending that hookup |
| Refactoring `coach-ai.ts`'s model singleton into a shared helper | Avoid touching EPIC 9 code in this slice; the onboarding model factory duplicates the minimal pattern instead |
| Email/name uniqueness or existing-account checks | This slice validates format/plausibility only; uniqueness is EPIC 14's persistence concern |
| Any `prisma/schema.prisma` change | Nothing in SCRUM-100–104 requires persistence; avoids colliding with EPIC 14's in-flight, unmerged `User` field changes |

## Assumptions & Decisions

| Assumption / decision | Chosen default | Confirmed? |
| --- | --- | --- |
| Package | Add `@langchain/langgraph@^1.4.8` as an **explicit direct dependency**. It already resolves transitively (via `langchain@^1.5.3`) and is peer-compatible with the installed `@langchain/core@1.2.3` (peer range `^1.1.48`) | y — verified via `npm view`, no version conflict |
| Multi-turn mechanism | `interrupt()` / `Command({ resume })` (LangGraph's human-in-the-loop primitive) pauses each `COLLECT_*` node after asking its question, resuming on the next `.invoke()` with the user's reply; checkpointed by `thread_id` | **n — needs your confirmation**, see Design § Multi-turn execution |
| Checkpointer | `MemorySaver` (in-memory) for this slice. **Not production-safe on Vercel** (state doesn't survive across serverless invocations) — flagged as a known gap, not silently accepted | n — needs your confirmation before this reaches an API route |
| State shape | `Annotation.Root` with `messages` (`addMessages` reducer), `step`, `collectedName` / `collectedEmail` / `collectedDob`, `lastValidationError` | y |
| Field validation | Per-node LLM structured-output extraction (`model.withStructuredOutput(zodSchema)`) + a Zod guardrail schema, mirroring `coach-ai.ts`'s pattern | y |
| Model | Reuse `ENV_VARS.OPENAI_API_KEY` / `OPENAI_MODEL`, same `OPENAI_TIMEOUT_MS` / retry-with-backoff shape as `coach-ai.ts` | y |
| Folder layout | `src/lib/onboarding/{index.ts,state.ts,graph.ts,model.ts,schemas.ts,nodes/*.ts}` — barrel pattern matching `src/lib/moderation/` | y |
| Fallback on missing `OPENAI_API_KEY` | Each node emits a static, deterministic message/re-prompt instead of throwing — same fallback contract as `coach-ai.ts` | y |
| `COLLECT_DOB` success edge | Routes to `END` as an explicit, named placeholder (not a real terminal state) pending a future password/submit ticket | y |
| Publish | Local branches/commits only until you ask to push/PR (matches existing project convention in `.specs/features/hitl-moderation/tasks.md`) | y |

## User Stories

### P1: LangGraph environment & graph structure (SCRUM-100) ⭐ MVP

**Acceptance Criteria**:

1. WHEN `@langchain/langgraph` is used THEN it SHALL be declared as an explicit
   direct dependency in `package.json` (not relied upon transitively via `langchain`).
2. WHEN the onboarding graph module is imported THEN a compiled `StateGraph` SHALL
   exist with `GREETING`, `COLLECT_NAME`, `COLLECT_EMAIL`, `COLLECT_DOB` registered
   as nodes and `START` wired to `GREETING`.
3. WHEN the graph state is defined THEN it SHALL use `Annotation.Root` with typed
   fields for the message transcript and each collected field, per Assumptions.
4. WHEN the graph module is loaded and `OPENAI_API_KEY` is unset THEN construction
   SHALL NOT throw — the missing key is handled per-node at invocation time, not at
   graph-build time (mirrors `coach-ai.ts`'s lazy singleton).

### P1: GREETING node (SCRUM-101)

**Acceptance Criteria**:

1. WHEN the graph is invoked for a new thread (no prior checkpoint) THEN `GREETING`
   SHALL run first and produce an assistant message that introduces the assistant
   and explains the signup flow.
2. WHEN `GREETING` completes THEN the graph SHALL transition unconditionally to
   `COLLECT_NAME` (no guardrail/loop on this node).
3. WHEN `OPENAI_API_KEY` is not configured THEN `GREETING` SHALL emit a static
   fallback introduction rather than failing.

### P1: COLLECT_NAME node (SCRUM-102)

**Acceptance Criteria**:

1. WHEN `COLLECT_NAME` runs THEN it SHALL prompt the user for their full name.
2. WHEN the user's reply contains an extractable, plausible full name THEN the node
   SHALL set `collectedName` and the graph SHALL transition to `COLLECT_EMAIL`.
3. WHEN the reply fails guardrail validation (empty, unreasonably long, non-name
   content, or an apparent prompt-injection attempt) THEN the node SHALL NOT set
   `collectedName`, SHALL set `lastValidationError`, and the graph SHALL loop back
   to `COLLECT_NAME` with a clarifying re-prompt.
4. WHEN the model call fails or `OPENAI_API_KEY` is absent THEN the node SHALL fall
   back to a deterministic re-prompt rather than throwing.

### P1: COLLECT_EMAIL node (SCRUM-103)

**Acceptance Criteria**:

1. WHEN `COLLECT_EMAIL` runs THEN it SHALL prompt the user for their email address.
2. WHEN the user's reply contains a syntactically valid email (`z.email()`) THEN
   the node SHALL set `collectedEmail` and the graph SHALL transition to
   `COLLECT_DOB`.
3. WHEN the reply fails the email guardrail THEN the node SHALL NOT set
   `collectedEmail`, SHALL set `lastValidationError`, and the graph SHALL loop back
   to `COLLECT_EMAIL` with a clarifying re-prompt.
4. WHEN the model call fails or `OPENAI_API_KEY` is absent THEN the node SHALL fall
   back to a deterministic re-prompt rather than throwing.

### P1: COLLECT_DOB node (SCRUM-104)

**Acceptance Criteria**:

1. WHEN `COLLECT_DOB` runs THEN it SHALL prompt the user for their date of birth.
2. WHEN the user's reply contains a plausible date of birth (parseable, not in the
   future, within a reasonable age range) THEN the node SHALL set `collectedDob`
   and the graph SHALL transition to the placeholder terminal state (`END`).
3. WHEN the reply fails the date-of-birth guardrail THEN the node SHALL NOT set
   `collectedDob`, SHALL set `lastValidationError`, and the graph SHALL loop back
   to `COLLECT_DOB` with a clarifying re-prompt.
4. WHEN the model call fails or `OPENAI_API_KEY` is absent THEN the node SHALL fall
   back to a deterministic re-prompt rather than throwing.
