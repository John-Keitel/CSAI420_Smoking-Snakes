# LangGraph Onboarding State Machine Tasks

**Design**: `.specs/features/onboarding-langgraph/design.md`
**Epic**: EPIC 13 — LangGraph Onboarding State Machine
**Publish policy**: Local branches + commits only; do not push or open PRs until asked.

## Before starting T1

The multi-turn mechanism (`interrupt()` + `MemorySaver`) in design.md is marked
unconfirmed in spec.md § Assumptions. Get that confirmed — it shapes every node's
function signature — before writing `graph.ts` or any node.

## Gate Check Commands

| Gate | Command |
| --- | --- |
| Unit tests | `npm test -- __test__/unit/onboarding` |
| Lint | `npm run lint` — **known pre-existing failure**: `eslint@^10.7.0` on current `main` crashes `eslint-plugin-react`'s `display-name` rule (see open PR #39, unmerged). This is not caused by this slice; don't chase it down inside this work. |
| Typecheck | `npm run typecheck` |

## Task Breakdown

### T1 / SCRUM-100 — LangGraph environment + graph structure

**Branch**: `feature/scrum-100-onboarding-langgraph-setup`

- Add `@langchain/langgraph@^1.4.8` as an explicit direct dependency in `package.json`
  (currently resolves transitively via `langchain@^1.5.3`; pin it directly since this
  module imports from it directly, matching how `@langchain/core`/`@langchain/openai`
  are already direct deps rather than relied upon via the `langchain` meta-package)
- `src/lib/onboarding/state.ts` — `Annotation.Root` state shape
- `src/lib/onboarding/model.ts` — lazy `ChatOpenAI` singleton (duplicated from
  `coach-ai.ts`'s pattern, not imported from it — see design.md)
- `src/lib/onboarding/graph.ts` — `StateGraph` with `GREETING`/`COLLECT_NAME`/
  `COLLECT_EMAIL`/`COLLECT_DOB` nodes registered as stubs, `START → GREETING` wired,
  `.compile({ checkpointer: new MemorySaver() })`
- `src/lib/onboarding/index.ts` — barrel export
- Tests: graph compiles; node set matches spec; missing `OPENAI_API_KEY` doesn't
  throw at construction time

### T2 / SCRUM-101 — GREETING node

**Branch**: `feature/scrum-101-onboarding-greeting-node` (from T1 tip)

- `src/lib/onboarding/nodes/greeting.ts` — intro message + fallback copy
- Wire real `GREETING` node into `graph.ts` (replacing the T1 stub), unconditional
  edge to `COLLECT_NAME`
- Tests: produces intro message; unconditional transition; fallback path when
  `OPENAI_API_KEY` unset

### T3 / SCRUM-102 — COLLECT_NAME node

**Branch**: `feature/scrum-102-onboarding-collect-name-node` (from T2 tip)

- `src/lib/onboarding/schemas.ts` — `NameFieldSchema`
- `src/lib/onboarding/nodes/collect-name.ts` — prompt, extract, guardrail, loop-or-advance
- Tests: valid name → `collectedEmail` node reached; empty/implausible/injection
  attempt → re-prompt, `collectedName` stays unset; model failure → deterministic
  fallback re-prompt, no throw

### T4 / SCRUM-103 — COLLECT_EMAIL node

**Branch**: `feature/scrum-103-onboarding-collect-email-node` (from T3 tip)

- `src/lib/onboarding/schemas.ts` — add `EmailFieldSchema` (`z.email()`)
- `src/lib/onboarding/nodes/collect-email.ts`
- Tests: valid email → transitions to `COLLECT_DOB`; invalid format → re-prompt;
  model failure → fallback re-prompt, no throw

### T5 / SCRUM-104 — COLLECT_DOB node

**Branch**: `feature/scrum-104-onboarding-collect-dob-node` (from T4 tip)

- `src/lib/onboarding/schemas.ts` — add `DobFieldSchema` (parseable, not future-dated,
  plausible age range)
- `src/lib/onboarding/nodes/collect-dob.ts` — success edge routes to `END`
  (named placeholder — see design.md)
- Tests: valid DOB → reaches placeholder `END`; future date / implausible age /
  unparseable → re-prompt; model failure → fallback re-prompt, no throw
- Full-graph smoke test: `GREETING → COLLECT_NAME → COLLECT_EMAIL → COLLECT_DOB → END`
  with all four replies valid on first attempt
