# LangGraph Onboarding State Machine Design

**Slice**: `.specs/features/onboarding-langgraph/`
**Spec**: `spec.md`
**Status**: Draft — multi-turn mechanism and checkpointer choice need your confirmation before implementation starts (see spec.md § Assumptions)

## Decision summary

| Concern | Choice |
| --- | --- |
| Package | `@langchain/langgraph@^1.4.8` as an explicit direct dependency (was transitive via `langchain`) |
| Graph state | `Annotation.Root` — `messages`, `step`, `collectedName/Email/Dob`, `lastValidationError` |
| Multi-turn pause/resume | `interrupt()` inside each `COLLECT_*` node; caller resumes via `Command({ resume: <reply> })` |
| Checkpointer (this slice) | `MemorySaver` — in-process only, not durable across serverless invocations |
| Model | `ChatOpenAI` singleton per `src/lib/onboarding/model.ts`, same timeout/retry shape as `coach-ai.ts` |
| Validation | LLM structured-output extraction (`withStructuredOutput`) + Zod guardrail schema per field |
| Branching | One local branch per SCRUM ticket; no push until asked |

## Why LangGraph's `interrupt()`, not one node per HTTP call

The graph must ask one question, wait for a real human reply (a separate HTTP
request in practice), then continue — not run all four `COLLECT_*` nodes back to
back in a single `.invoke()`. LangGraph's `interrupt(value)` primitive is built for
exactly this: a node calls `interrupt(question)`, execution pauses and returns the
question to the caller, and the *next* `.invoke(new Command({ resume: userReply }))`
against the same `thread_id` resumes that node with `userReply` as the return value
of `interrupt()`. This keeps all the conversational logic — ask, validate, loop, or
advance — inside the node itself, which is what SCRUM-102–104 each ask for
independently. The alternative (splitting "ask" and "validate" into separate graph
invocations glued together by route-layer code) would spread each node's guardrail
logic across two places and contradicts the one-node-per-ticket shape of SCRUM-101–104.

**This is the part flagged "n" in spec.md** — confirm before implementation, since it
determines the node function signature for every ticket in this slice.

## Data model

No `prisma/schema.prisma` changes in this slice (see spec.md § Out of Scope). Graph
state lives in `@langchain/langgraph`'s own checkpoint store, not Postgres, for
SCRUM-100–104.

```ts
// src/lib/onboarding/state.ts
import { Annotation } from '@langchain/langgraph';
import { addMessages, type BaseMessage } from '@langchain/core/messages';

export const OnboardingStateAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({ reducer: addMessages, default: () => [] }),
    step: Annotation<'GREETING' | 'COLLECT_NAME' | 'COLLECT_EMAIL' | 'COLLECT_DOB' | 'COMPLETE'>({
        reducer: (_prev, next) => next,
        default: () => 'GREETING',
    }),
    collectedName: Annotation<string | null>({ reducer: (_p, n) => n, default: () => null }),
    collectedEmail: Annotation<string | null>({ reducer: (_p, n) => n, default: () => null }),
    collectedDob: Annotation<string | null>({ reducer: (_p, n) => n, default: () => null }),
    lastValidationError: Annotation<string | null>({ reducer: (_p, n) => n, default: () => null }),
});

export type OnboardingState = typeof OnboardingStateAnnotation.State;
```

## Components

```text
src/lib/onboarding/
├── index.ts        # barrel — exports compiled graph + types (matches src/lib/moderation/index.ts)
├── state.ts         # Annotation.Root — SCRUM-100
├── graph.ts          # StateGraph wiring, compile(), MemorySaver — SCRUM-100
├── model.ts           # getOnboardingModel() singleton — mirrors coach-ai.ts, duplicated not shared
├── schemas.ts          # Zod guardrails: NameFieldSchema, EmailFieldSchema, DobFieldSchema
└── nodes/
    ├── greeting.ts       # SCRUM-101
    ├── collect-name.ts    # SCRUM-102
    ├── collect-email.ts    # SCRUM-103
    └── collect-dob.ts       # SCRUM-104
```

| Path | Role |
| --- | --- |
| `src/lib/onboarding/state.ts` | Shared `Annotation.Root` state shape |
| `src/lib/onboarding/graph.ts` | `new StateGraph(OnboardingStateAnnotation)`, node registration, conditional edges, `.compile({ checkpointer: new MemorySaver() })` |
| `src/lib/onboarding/model.ts` | Lazy `ChatOpenAI` singleton, `OPENAI_TIMEOUT_MS`/retry constants (duplicated from `coach-ai.ts` by design — see spec.md Out of Scope) |
| `src/lib/onboarding/schemas.ts` | Per-field Zod guardrails, used both for LLM `withStructuredOutput` and defense-in-depth re-validation |
| `src/lib/onboarding/nodes/*.ts` | One node function per ticket: `(state) => Promise<Partial<OnboardingState>>` |

## Node contract (applies to SCRUM-101–104)

```ts
type OnboardingNode = (state: OnboardingState) => Promise<Partial<OnboardingState>>;
```

Each `COLLECT_*` node:

1. Calls `interrupt({ question: <prompt copy> })` to surface its question and pause.
2. On resume, receives the user's reply as the `interrupt()` return value.
3. Runs the reply through `model.withStructuredOutput(FieldSchema)` to extract +
   self-assess validity (same shape as `coachResponseSchema` in `coach-ai.ts`).
4. Re-validates the extracted value against the Zod guardrail schema directly
   (do not trust the LLM's self-reported `valid` flag alone).
5. On success: sets the collected field, clears `lastValidationError`, returns
   state with `step` advanced.
6. On failure: sets `lastValidationError`, leaves `step` unchanged (conditional
   edge routes back to the same node).
7. On model/timeout failure or missing `OPENAI_API_KEY`: returns a deterministic
   fallback re-prompt, never throws (matches `coach-ai.ts`'s `fallbackResponse`).

`GREETING` (SCRUM-101) is simpler — no guardrail, no loop, unconditional edge to
`COLLECT_NAME` — but still uses the fallback-on-missing-key pattern for its intro copy.

## State transitions

```text
START --> GREETING --unconditional--> COLLECT_NAME
COLLECT_NAME  --valid--> COLLECT_EMAIL     COLLECT_NAME  --invalid--> COLLECT_NAME
COLLECT_EMAIL --valid--> COLLECT_DOB       COLLECT_EMAIL --invalid--> COLLECT_EMAIL
COLLECT_DOB   --valid--> END (placeholder) COLLECT_DOB   --invalid--> COLLECT_DOB
```

`END` after `COLLECT_DOB` is a named placeholder, not a real "onboarding complete"
state — a future ticket (not in SCRUM-100–104) replaces it with `COLLECT_PASSWORD`
and a call into EPIC 14's `POST /api/user/register-chat` once that lands past its
current 501 stub.

## Error / logging

- No route handlers in this slice, so no `HttpException` mapping yet.
- Node-level model failures: caught inside the node, logged via
  `getAppLogger('lib:onboarding:<node>')`, never thrown — a broken OpenAI call
  degrades to a re-prompt, not a crashed graph.
- Guardrail failures (bad input, not a system error): logged at `debug`, surfaced
  to the user via `lastValidationError`, not `logger.error`.

## Known gap to confirm before this ships behind a route

`MemorySaver` checkpoints live in the Node process's memory. On Vercel (Fluid
Compute, but still ephemeral per-instance), a checkpoint written by one invocation
is not guaranteed to be readable by the next — a user could get re-greeted mid-flow.
This is fine for unit-testing the graph in isolation (this slice), but **must** be
replaced with a durable checkpointer (e.g., a Postgres-backed one against the
existing `DATABASE_URL`) before any HTTP route exposes this graph to real users.
Flagging now so it isn't discovered after SCRUM-104 is "done."
