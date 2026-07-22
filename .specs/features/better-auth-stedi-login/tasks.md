# Better Auth STEDI Login Migration Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/better-auth-stedi-login/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found: `AGENTS.md`, `README.md`, `package.json`, `vitest.config.mts`, `playwright.config.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Auth bridge and session-resolution domain logic | unit | All branches; 1:1 to spec ACs; invalid-credential, timeout, missing-token, and sign-out cleanup edge cases | `__test__/unit/**/*.test.ts` | `npm run test:unit` |
| Route handlers and server actions | unit | Happy path + validation + error branches for each changed route/action, using the repo's mocked-handler style | `__test__/unit/**/*.test.ts` | `npm run test:unit` |
| Browser login and dashboard navigation flow | e2e | Happy path + invalid credentials + redirect/access-control paths for `/login` and `/dashboard` | `__test__/e2e/**/*.spec.ts` | `npm run test:e2e` |
| Deployed STEDI pass-through integration flow | integration | At least one end-to-end auth-to-STEDI flow proving server-side token resolution without `POST /login` dependency | `__test__/integration_tests/**/*.test.ts` | `npm run test:integration` |
| Prisma schema, env contract, and configuration-only changes | none | Build gate only | — | `npm run typecheck` |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit | Yes | Mocked dependencies reset per test with `beforeEach` / `afterEach` | `__test__/unit/stedi-api.test.ts`, `__test__/unit/rapidsteptest-route.test.ts` |
| e2e | Yes | Playwright worker/browser-context isolation with `fullyParallel: true` | `playwright.config.ts` |
| integration | No | Shared `API_URL` target, shared seeded user/token, and `beforeAll` state setup | `__test__/integration_tests/IVR.test.ts` |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit tests only | `npm run test:unit` |
| Full | After tasks with e2e or deployed integration test impact | `npm run test:unit && npm run test:integration && npm run test:e2e` |
| Build | After phase completion or config/entity-only tasks | `npm run typecheck && npm run lint && npm run test:all` |

---

## Execution Plan

### Phase 1: Foundation (Sequential)

Tasks that must be done first, in order.

```
T1 → T2 → T3 → T4
```

### Phase 2: Auth Core (Mixed)

After the STEDI bridge exists, migrate app auth and token resolution.

```
T4 → T5 → T6
        └→ T7
```

### Phase 3: Login UI and Route Migration (Sequential)

Bring the browser login flow online and retire the old `/login` route.

```
T6 → T8 → T9 → T10
```

### Phase 4: Regression Coverage and Docs (Parallel OK)

After the feature is wired end to end, migrate tests and docs.

```
        ┌→ T11
T10 ────┼→ T12
        └→ T13
```

---

## Task Breakdown

### T1: Add Better Auth dependencies and auth env contract

**What**: Add Better Auth package dependencies and define the environment variables/config documentation needed for the new browser-session model.
**Where**: `package.json`, env documentation files, auth config entry points
**Depends on**: None
**Reuses**: Existing env loading in `src/lib/env-vars.ts`, README auth/setup sections
**Requirement**: BALOG-08, BALOG-10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Better Auth dependencies are declared
- [ ] Required auth env variables are identified in code/docs
- [ ] No stale documentation claims remain about the old JWT-only auth model in the touched setup docs
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test:all`

**Tests**: none
**Gate**: build

---

### T2: Extend Prisma for Better Auth persistence and STEDI session links

**What**: Add the database models needed for Better Auth persistence and an app-owned STEDI-session-link table.
**Where**: `prisma/schema.prisma` and related migration files
**Depends on**: T1
**Reuses**: Existing Prisma schema conventions and session/user relationships
**Requirement**: BALOG-05, BALOG-07, BALOG-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Better Auth persistence requirements are reflected in the Prisma schema
- [ ] A dedicated STEDI-session-link model is added or its equivalent is explicitly modeled
- [ ] Schema changes are consistent with current naming and relationship conventions
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test:all`

**Tests**: none
**Gate**: build

---

### T3: Add Better Auth server configuration and handler scaffold

**What**: Create the Better Auth server configuration and route handler scaffold used by the app.
**Where**: `src/lib/auth/` and a new Better Auth App Router handler under `src/app/api/auth/`
**Depends on**: T2
**Reuses**: Existing auth abstraction boundaries and env configuration
**Requirement**: BALOG-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Better Auth server configuration is centralized
- [ ] Route handler wiring exists for the library surface the app will use
- [ ] At least 2 new unit tests cover auth handler/config smoke behavior
- [ ] Gate check passes: `npm run test:unit`

**Tests**: unit
**Gate**: quick

---

### T4: Implement the STEDI credentials bridge and token link repository

**What**: Create the server-side STEDI login bridge plus persistence helpers for binding STEDI tokens to auth sessions.
**Where**: `src/lib/auth/stedi-login.ts`, `src/lib/auth/stedi-session-link.ts`, `src/lib/schemas.ts`
**Depends on**: T3
**Reuses**: Error/timeout patterns from `src/lib/stedi-api.ts`, Prisma access patterns
**Requirement**: BALOG-02, BALOG-03, BALOG-04, BALOG-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] A shared Zod login schema exists in `src/lib/schemas.ts` for `username` and `password`
- [ ] The bridge validates `username`/`password` input and calls STEDI `/login`
- [ ] Success, invalid credentials, timeout, and upstream failure are normalized into app-consumable results
- [ ] STEDI token persistence helpers can create, read, and delete token links by auth session ID
- [ ] At least 4 new unit tests cover success and failure branches
- [ ] Gate check passes: `npm run test:unit`

**Tests**: unit
**Gate**: quick

---

### T5: Replace app session lookup and sign-out with Better Auth session semantics

**What**: Rework the server-side auth helpers and sign-out flow to resolve the current user from Better Auth instead of bearer JWT headers.
**Where**: `src/lib/auth/index.ts`, `src/app/auth/signout/route.ts`
**Depends on**: T4
**Reuses**: Existing `getSession()` call sites and route locations
**Requirement**: BALOG-07, BALOG-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Protected app code no longer depends on `authorization: Bearer ...` for the migrated auth path
- [ ] Sign-out clears the Better Auth session and STEDI token link
- [ ] At least 3 new unit tests cover authenticated, unauthenticated, and sign-out cleanup cases
- [ ] Gate check passes: `npm run test:unit`

**Tests**: unit
**Gate**: quick

---

### T6: Update STEDI proxy and legacy session validation to resolve tokens server-side

**What**: Change the STEDI proxy helper and legacy session validator to read the STEDI token from authenticated server session state.
**Where**: `src/lib/stedi-api.ts`, `src/lib/auth/suresteps.ts`
**Depends on**: T5
**Reuses**: Existing proxy path validation, current legacy header handling where still needed
**Requirement**: BALOG-05, BALOG-06, BALOG-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Authenticated browser/session flows can resolve the STEDI token without a client-sent legacy header
- [ ] Missing token-link state is handled as unauthorized/expired auth
- [ ] At least 4 new unit tests cover header fallback, session lookup, missing-token, and sign-out-adjacent behavior
- [ ] Gate check passes: `npm run test:unit`

**Tests**: unit
**Gate**: quick

---

### T7: Rework `/auth/signin` onto Better Auth-backed session behavior

**What**: Replace the current custom JWT sign-in route logic with Better Auth-backed session creation behavior that aligns with the new auth model.
**Where**: `src/app/auth/signin/route.ts`
**Depends on**: T5
**Reuses**: Existing validation/error formatting patterns and the STEDI credentials bridge where appropriate
**Requirement**: BALOG-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `/auth/signin` no longer mints the current custom bearer JWT
- [ ] Route behavior aligns with the Better Auth session contract adopted by the app
- [ ] At least 3 new unit tests cover valid credentials, invalid credentials, and validation failure
- [ ] Gate check passes: `npm run test:unit`

**Tests**: unit
**Gate**: quick

---

### T8: Create the login server action contract

**What**: Add the login form schema/state contract and the server action that validates credentials, creates the session, and redirects or returns errors.
**Where**: `src/app/login/actions.ts`, `src/lib/schemas.ts`
**Depends on**: T6
**Reuses**: Existing Zod schema/error formatting patterns and the STEDI credentials bridge
**Requirement**: BALOG-01, BALOG-02, BALOG-03, BALOG-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] The server action accepts form data for `username` and `password`
- [ ] The server action parses credentials through the shared Zod login schema instead of bespoke field checks
- [ ] Success redirects to `/dashboard`
- [ ] Validation and upstream failures return structured action state for the client form
- [ ] At least 4 new unit tests cover valid, invalid, timeout, and validation-error paths
- [ ] Gate check passes: `npm run test:unit`

**Tests**: unit
**Gate**: quick

---

### T9: Build the `/login` page and client form

**What**: Create the server page and client component that render the login form, pending state, and action error feedback.
**Where**: `src/app/login/page.tsx`, `src/app/login/login.tsx`
**Depends on**: T8
**Reuses**: Existing page shell patterns and `src/components/ui/button.tsx`
**Requirement**: BALOG-01, BALOG-03, BALOG-04

**Tools**:

- MCP: NONE
- Skill: `react-best-practices`

**Done when**:

- [ ] `/login` renders a usable username/password form wired to the server action
- [ ] Pending and error states are visible in the client component
- [ ] At least 3 new e2e tests cover page render, invalid credentials, and successful login redirect
- [ ] Gate check passes: `npm run test:unit && npm run test:integration && npm run test:e2e`

**Tests**: e2e
**Gate**: full

---

### T10: Add `/dashboard` and retire the legacy `/login` route

**What**: Create the minimal dashboard landing page, enforce its auth boundary, and remove the obsolete `/login` pass-through route.
**Where**: `src/app/dashboard/page.tsx`, `src/app/login/`, legacy `/login` route location
**Depends on**: T9
**Reuses**: Existing page layout patterns and the new Better Auth session resolver
**Requirement**: BALOG-03, BALOG-08, BALOG-09

**Tools**:

- MCP: NONE
- Skill: `react-best-practices`

**Done when**:

- [ ] `/dashboard` exists as a minimal authenticated landing page
- [ ] Anonymous `/dashboard` requests redirect to `/login`
- [ ] The old `/login` POST pass-through route is removed from app code
- [ ] At least 3 new e2e tests cover dashboard access control and login-to-dashboard navigation
- [ ] Gate check passes: `npm run test:unit && npm run test:integration && npm run test:e2e`

**Tests**: e2e
**Gate**: full

---

### T11: Update Playwright auth helpers and browser auth specs

**What**: Rewrite the repo's e2e auth helpers/specs so they validate session/cookie behavior instead of bearer JWT issuance.
**Where**: `__test__/e2e/helpers/auth.helper.ts`, `__test__/e2e/app/auth/signin.spec.ts`
**Depends on**: T10
**Reuses**: Existing Playwright request helpers and auth test locations
**Requirement**: BALOG-08, BALOG-10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] E2E helpers no longer expect `Authorization: Bearer ...` from `/auth/signin`
- [ ] Browser/session assertions reflect the Better Auth model
- [ ] At least 2 updated e2e tests pass for the migrated auth flow
- [ ] Gate check passes: `npm run test:unit && npm run test:integration && npm run test:e2e`

**Tests**: e2e
**Gate**: full

---

### T12: Rewrite deployed integration tests that depended on `POST /login`

**What**: Replace app-`/login`-based integration setup with an explicit auth helper that still proves downstream STEDI-backed access works after the migration.
**Where**: `__test__/integration_tests/IVR.test.ts` and related integration helpers
**Depends on**: T10
**Reuses**: Existing deployed integration patterns and STEDI pass-through expectations
**Requirement**: BALOG-05, BALOG-06, BALOG-10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] No deployed integration test depends on the deleted app `/login` endpoint
- [ ] At least one integration flow proves downstream STEDI access after authentication with the new contract
- [ ] At least 2 updated integration tests pass for the migrated auth behavior
- [ ] Gate check passes: `npm run test:unit && npm run test:integration && npm run test:e2e`

**Tests**: integration
**Gate**: full

---

### T13: Update auth and route documentation for the new contract

**What**: Revise docs so setup, route listings, and auth behavior reflect Better Auth sessions and the removed `/login` pass-through route.
**Where**: `README.md` and any touched auth setup docs
**Depends on**: T10
**Reuses**: Existing README auth/API route sections
**Requirement**: BALOG-10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Auth setup docs describe the Better Auth session model and required env values
- [ ] API route docs no longer advertise the removed legacy `/login` route or JWT-only sign-in behavior
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test:all`

**Tests**: none
**Gate**: build

---

## Parallel Execution Map

Visual representation of task ordering within phases (`[P]` = order-free, no inter-task dependency):

```
Phase 1 (Sequential):
  T1 ──→ T2 ──→ T3 ──→ T4

Phase 2 (Mixed):
  T4 complete, then:
    T5 ──→ T6 [sequential]
      └──→ T7 [P relative to T6]

Phase 3 (Sequential):
  T6 complete, then:
    T8 ──→ T9 ──→ T10

Phase 4 (Parallel):
  T10 complete, then:
    ├── T11 [P]
    ├── T12 [P]
    └── T13 [P]
```

**Parallelism constraint:** A task marked `[P]` must have ALL of these:

- No unfinished dependencies
- Required test type is parallel-safe (per the **Parallelism Assessment** generated above)
- No shared mutable state with other `[P]` tasks in the same phase

If a task's tests are NOT parallel-safe, it MUST run sequentially even if its
implementation code has no dependencies. The test execution is the bottleneck.

`[P]` is ordering information — it tells the executing agent (or phase worker) that these
tasks have no inter-task dependency and can be done in any order within the phase. It is
NOT a directive to spawn a sub-agent per task.

**How phase-based execution works:**

When a feature has more than 3 phases, the agent offers to dispatch one sub-agent per phase
(sequential). Each phase worker executes ALL tasks in its assigned phase in order, then reports
a compact summary back to the orchestrator. See `sub-agents.md` for the
full model — trigger threshold, offer-then-confirm rule, worker payload, compact summary
contract, failure handling, and context sizing guidance.

For features with 3 or fewer phases, execution happens inline in the main window with no
sub-agents spawned.

`[P]` marks tasks that have no inter-task dependency within a phase (order-free). It is
informational — it tells the worker (or the main agent) those tasks can be done in any order.
It is NOT a directive to spawn a sub-agent per task.

**The orchestrating agent's role during Execute:**

1. Assess phase count — offer sub-agents if >3 phases and user accepts
2. Dispatch the next phase (to a worker, or execute inline)
3. Receive the compact phase summary
4. Update tasks.md with results
5. If the phase summary shows all tasks complete: proceed to the next phase
6. If a task failed: decide fix/escalate before dispatching the next phase

---

## Task Granularity Check

Before approving tasks, verify they are granular enough:

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Add Better Auth dependencies and auth env contract | 1 config/doc slice | ✅ Granular |
| T2: Extend Prisma for Better Auth persistence and STEDI session links | 1 schema/migration slice | ✅ Granular |
| T3: Add Better Auth server configuration and handler scaffold | 1 auth bootstrap slice | ✅ Granular |
| T4: Implement the STEDI credentials bridge and token link repository | 2 tightly coupled auth utility files | ✅ Cohesive |
| T5: Replace app session lookup and sign-out with Better Auth session semantics | 1 auth helper slice | ✅ Granular |
| T6: Update STEDI proxy and legacy session validation to resolve tokens server-side | 2 tightly related auth/proxy files | ✅ Cohesive |
| T7: Rework `/auth/signin` onto Better Auth-backed session behavior | 1 route slice | ✅ Granular |
| T8: Create the login server action contract | 1 server-action slice | ✅ Granular |
| T9: Build the `/login` page and client form | 1 UI slice | ✅ Granular |
| T10: Add `/dashboard` and retire the legacy `/login` route | 1 route-migration slice | ✅ Cohesive |
| T11: Update Playwright auth helpers and browser auth specs | 1 e2e test slice | ✅ Granular |
| T12: Rewrite deployed integration tests that depended on `POST /login` | 1 integration test slice | ✅ Granular |
| T13: Update auth and route documentation for the new contract | 1 documentation slice | ✅ Granular |

**Granularity check**:

- ✅ 1 component / 1 function / 1 endpoint = Good
- ⚠️ 2-3 related things in same file = OK if cohesive
- ❌ Multiple components or files = MUST split

---

## Diagram-Definition Cross-Check

Before approving tasks, verify the execution diagram is consistent with the task definitions. These are independent artifacts that can drift — the diagram is drawn for visual clarity while task bodies are written for precision. Both must agree.

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Starts Phase 1 | ✅ Match |
| T2 | T1 | `T1 → T2` | ✅ Match |
| T3 | T2 | `T2 → T3` | ✅ Match |
| T4 | T3 | `T3 → T4` | ✅ Match |
| T5 | T4 | `T4 → T5` | ✅ Match |
| T6 | T5 | `T5 → T6` | ✅ Match |
| T7 | T5 | `T5 → T7` | ✅ Match |
| T8 | T6 | `T6 → T8` | ✅ Match |
| T9 | T8 | `T8 → T9` | ✅ Match |
| T10 | T9 | `T9 → T10` | ✅ Match |
| T11 | T10 | `T10 → T11` | ✅ Match |
| T12 | T10 | `T10 → T12` | ✅ Match |
| T13 | T10 | `T10 → T13` | ✅ Match |

**Rules:**

- Every `Depends on` in a task body must have a corresponding arrow in the diagram.
- Every arrow in the diagram must correspond to a `Depends on` in the target task's body.
- Tasks shown as parallel (`[P]`) in the diagram must not depend on each other.
- If a task depends on another task in the same parallel phase, they are NOT parallel — fix the diagram or remove the `[P]` flag.

---

## Test Co-location Validation

Before approving tasks, verify EVERY task's `Tests` field is consistent with the **Test Coverage Matrix** generated above. This is a hard gate — tasks that fail this check MUST be fixed.

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Prisma/env/config docs | none | none | ✅ OK |
| T2 | Prisma schema / migration | none | none | ✅ OK |
| T3 | Route handler and auth bootstrap | unit | unit | ✅ OK |
| T4 | Auth bridge and session-link domain logic | unit | unit | ✅ OK |
| T5 | Auth session helper and sign-out route | unit | unit | ✅ OK |
| T6 | STEDI proxy/session resolution logic | unit | unit | ✅ OK |
| T7 | Sign-in route handler | unit | unit | ✅ OK |
| T8 | Login server action | unit | unit | ✅ OK |
| T9 | Browser login flow UI | e2e | e2e | ✅ OK |
| T10 | Dashboard access-control UI/route migration | e2e | e2e | ✅ OK |
| T11 | Browser auth e2e helpers/specs | e2e | e2e | ✅ OK |
| T12 | Deployed STEDI integration flow | integration | integration | ✅ OK |
| T13 | Documentation/config references | none | none | ✅ OK |

**Rules:**

- "Tested in another task" is NOT a valid justification for `Tests: none`. That is test deferral — the exact anti-pattern this validation prevents.
- `Tests: none` is only valid when the coverage matrix says "none" for that code layer.
- If a task creates MULTIPLE code layers (e.g., service + controller), use the HIGHEST test type required by any of them.
- Any ❌ VIOLATION → restructure the task to include its required tests before proceeding.

**Resolving compilation dependencies:**

When a task creates code that can't be tested until a later task completes (e.g., a controller that needs module wiring before its e2e tests can run), do NOT defer the tests to a separate task. Instead, restructure:

1. **Merge forward:** Move the untestable task's tests into the earliest task where they become runnable.
2. **Merge backward:** Absorb the blocking dependency into the current task so it becomes self-testable.

Pick whichever option keeps tasks atomic and cohesive. The goal: no task produces unverified code. If code can't be tested in the task that creates it, the task boundaries are wrong.

---

## MCP / Skill Confirmation Needed Before Execute

Before implementation begins, confirm tool choices for this feature:

- **Required skill**: `tlc-spec-driven`
- **Helpful skill for UI tasks**: `react-best-practices`
- **Required MCPs**: none identified from the repo itself; implementation can proceed with built-in workspace tools unless the user wants an additional documentation MCP in the execution session

---

## Tips

- **[P] = Order-free** — Mark tasks with no inter-task dependency (can run in any order within the phase)
- **Reuses = Token saver** — Always reference existing code
- **Tools per task** — MCPs and Skills prevent wrong approaches
- **Dependencies are gates** — Clear what blocks what
- **Done when = Testable** — If you can't verify it, rewrite it
- **Requirement ID = Traceable** — Every task traces back to a spec requirement
- **One commit per task** — Plan the commit message format in advance

---

## Task Verification Standards

Every task MUST follow the `Done when` + `Tests` + `Gate` fields defined in the **Task Breakdown** template above. Each `Done when` entry must be specific, testable (binary pass/fail), and reference the gate check command from the `Gate Check Commands` section.
