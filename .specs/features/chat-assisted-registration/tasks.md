# Chat-Assisted Registration Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

**Repo override (NON-NEGOTIABLE):** planning and execution are two separate sessions. This `tasks.md` is the planning artifact; execution happens in a NEW session. No Jira publishing was requested by the user — execute directly, one task at a time, local commits only (no push/PR unless asked).

---

**Design**: `.specs/features/chat-assisted-registration/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found: `AGENTS.md`, `.specs/codebase/CONVENTIONS.md`, `.github/workflows/ci.yml`, `vitest.config.mts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Route handlers (`src/app/**/route.ts`) | unit | Happy path + every listed edge case + error paths per spec AC (pattern: direct `NextRequest` invocation, mocked `@/lib/db`, per-file `vi.hoisted` store — mirror `escalation-status-route.test.ts`) | `__test__/unit/*.test.ts` | `npm run test:unit` |
| Domain logic (`handleRegistrationEscalation`, session state machine, schemas, `flattenZodErrors`) | unit | 1:1 to spec ACs; all listed edge cases; discrimination on error messages ("password" substring, flat `errors` array) | `__test__/unit/*.test.ts` | `npm run test:unit` |
| Repository + full-cycle (route → handler → repository) | integration | Full cycle with in-memory mocked store, mirroring `escalation-full-cycle.test.ts` (context growth across two calls; escalation row persisted + status readable) | `__test__/integration/*.test.ts` | `npx vitest run __test__/integration` |
| Prisma model / migration | none | Build gate only (`npm run typecheck`) | `prisma/schema.prisma`, `prisma/migrations/` | `npm run typecheck` |
| External suite (official Week 5) | e2e (external repo) | `API_URL=http://localhost:3000 npm run test:week5` — 15/15 pass against local `next dev` | `../week-5-integration-tests-asf0/__test__/week5.test.js` | `npm run test:week5` (from clone repo) |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (`__test__/unit`) | Yes | Per-file `vi.hoisted` in-memory store + `vi.mock('@/lib/db')`; no shared DB | `__test__/unit/escalation-handler.test.ts:29-73`, vitest runs files in isolated workers |
| integration (`__test__/integration`) | Yes | Same per-file in-memory store pattern | `__test__/integration/escalation-full-cycle.test.ts:29-73` |
| External suite (week5) | No | Shared live DB via `API_URL`; cleanup via `afterEach` DELETEs | `week-5-integration-tests-asf0/__test__/week5.test.js:11-33` — must run sequentially against one server |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After tasks with unit tests only (T1, T3, T4, T6) | `npm run test:unit` + `npm run lint` |
| Full | After tasks with integration tests (T5) | `npm run lint && npm run typecheck && npm run test:unit && npx vitest run __test__/integration` |
| Build | After schema/migration task (T2) | `npm run typecheck` + `npm run lint` |
| External | Final acceptance (T7) | `npm run test:week5` from the clone repo against local (`API_URL=http://localhost:3000`, `npm run dev` running) and deployed Vercel URL |

---

## Execution Plan

### Phase 1: Foundation (Parallel OK)

```
T1 [P]  Schemas + flat error formatter
T2 [P]  Prisma model + migration
```

### Phase 2: Core Implementation (Parallel OK)

```
T3 [P]  POST /user/chat-assisted        (depends T1)
T4 [P]  POST /escalate-registration     (depends T1)
T5 [P]  POST /chat/continue-session     (depends T1, T2)
T6 [P]  DELETE /user/[userId]           (depends T1)
```

### Phase 3: Final Gate (Sequential)

```
T7  Local + deployed official Week 5 suite (depends T3-T6)
```

---

## Task Breakdown

### T1: Feature schemas + flat error formatter [P]

**What**: Create the three Week 5 Zod schemas and the flat error formatter.
**Where**: `src/lib/schemas/chat-assisted-registration.schema.ts`, `src/lib/schemas/registration-escalation.schema.ts`, `src/lib/schemas/continue-session.schema.ts`, `src/lib/validation/week5-errors.ts`
**Depends on**: None
**Reuses**: `z.email()` + password regexes from `SignUpSchema` (`src/lib/schemas.ts:15-22`, copied — do not modify shared file); `z.treeifyError`-style enum patterns
**Requirement**: CAT-02, CAT-03, CAT-04, CAT-05, CAT-08, ESC-04, SES-01

**Tools**:
- MCP: `context7` (zod v4 API check if needed)
- Skill: NONE

**Done when**:
- [ ] `ChatAssistedRegistrationSchema` rejects invalid email / weak password / bad birthDate / missing fields; error messages contain the word "password" for password issues; names with `<`, `>`, `--`, `;` rejected; `phone` matches `^\+?\d{7,15}$`; `lastActivity` coerceable date
- [ ] `RegistrationEscalationSchema` rejects bad phone, missing `chatSessionId`, unknown `issueType`; accepts the 3 spec issueTypes + `validation_error`
- [ ] `ContinueSessionSchema` accepts `{ chatSessionId, message, context }`; limits per design
- [ ] `flattenZodErrors` returns `{ errors: string[] }` (never an object)
- [ ] Gate passes: `npm run test:unit` (test count: ≥ 8, no silent deletions) + `npm run lint`
- [ ] EPIC 14 `register-chat` files untouched (git diff confirms)

**Tests**: unit (schemas + formatter)
**Gate**: quick
**Commit**: `feat(chat-assisted-registration): add week5 schemas and flat error formatter`

---

### T2: `ChatRegistrationSession` Prisma model + migration [P]

**What**: Add the model and a migration so sessions persist.
**Where**: `prisma/schema.prisma`, `prisma/migrations/<timestamp>_add_chat_registration_sessions/`
**Depends on**: None
**Reuses**: Model style from `ChatSession` (`prisma/schema.prisma:81`); migration naming convention `YYYYMMDDHHMMSS_snake_case` (see `20260801220000_widen_user_fk_columns`)
**Requirement**: SES-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `ChatRegistrationSession` model present per design (string `chatSessionId` unique, `conversationContext Json`, `currentStep`, `lastActivity`, timestamps)
- [ ] Migration generated (`docker compose up -d postgres` then `npm run db:generate && npx prisma migrate dev --name add_chat_registration_sessions`), or hand-written via `prisma migrate diff` if no DB available
- [ ] `npm run typecheck` passes (Prisma client regenerated)
- [ ] Gate passes: `npm run typecheck` + `npm run lint`

**Tests**: none (schema layer — build gate only)
**Gate**: build

---

### T3: `POST /user/chat-assisted` route [P]

**What**: Implement the chat-assisted registration route per CAT-01…CAT-10.
**Where**: `src/app/user/chat-assisted/route.ts`
**Depends on**: T1
**Reuses**: bcrypt + `prisma.user.create` pattern from `register-chat` (`src/app/api/user/register-chat/route.ts:40-61`, reimplemented locally — do not modify), `HttpException`, `getAppLogger`
**Requirement**: CAT-01 → CAT-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] 201 contract: `{ user: { id, email, firstName, lastName, createdAt }, message: 'Account created successfully via chat assistant!' }`
- [ ] 400 `{ errors: string[], requiresChat: true }` for all validation failures; 400 for malformed/empty body
- [ ] 409 duplicate email; 408 `{ message: 'Chat session has expired' }` when `lastActivity` older than 30 min (checked before validation)
- [ ] International names stored and echoed unmodified; `locale` persisted when sent; `accessibilityMode`/`sessionMetrics` accepted
- [ ] Unit tests: happy path, each email/password matrix case, missing fields, XSS/SQLi reject, timeout 408, malformed→400 then valid→201, concurrency (5 parallel ≥ 1 success) — direct route invocation with mocked `@/lib/db`
- [ ] Gate passes: `npm run test:unit` (test count: ≥ 12) + `npm run lint`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(chat-assisted-registration): add POST /user/chat-assisted`

---

### T4: `POST /escalate-registration` + `handleRegistrationEscalation` [P]

**What**: Implement the registration escalation route and its issueType-driven handler.
**Where**: `src/app/escalate-registration/route.ts`, `src/lib/registration-escalation.ts`
**Depends on**: T1
**Reuses**: `createEscalation` (`src/lib/escalation/repository.ts`), `publishEscalationMessage` (`src/lib/escalation/queue.ts`), `stripHtml` (`src/lib/validation/index.ts`), SLA map from `src/lib/escalation/handler.ts:18` (replicated)
**Requirement**: ESC-01 → ESC-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] 200 `{ status: 'escalated', escalationId, estimatedResponseTime, message: 'Your registration issue has been forwarded to our support team' }`
- [ ] `technical_difficulties` → `estimatedResponseTime === '15-30 minutes'` exactly (HIGH); others → MEDIUM
- [ ] 400 `{ errors: string[] }` for bad phone / missing `chatSessionId` / unknown `issueType` / empty body
- [ ] Escalation persisted via `createEscalation` and published to queue; queue failure logged, request still 200
- [ ] `originalQuestion` derived from last user `conversationContext` message (fallbacks per design); `stripHtml` applied before store
- [ ] Unit tests: 3 issueTypes, SLA exact-string, 400 paths, queue-failure tolerance
- [ ] Gate passes: `npm run test:unit` (test count: ≥ 8) + `npm run lint`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(chat-assisted-registration): add POST /escalate-registration`

---

### T5: `POST /chat/continue-session` + session repository [P]

**What**: Implement the rule-based session continuation route and its repository.
**Where**: `src/app/chat/continue-session/route.ts`, `src/lib/chat-session-repository.ts`
**Depends on**: T1, T2
**Reuses**: `stripHtml`; Prisma model from T2; repository style from `src/lib/chat-history-repository.ts`
**Requirement**: SES-01 → SES-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] 200 `{ response, conversationContext, nextStep, sessionActive: true }`
- [ ] Same `chatSessionId` second call returns `conversationContext.length > 1` (grows: user msg + assistant reply per call)
- [ ] Unknown session id creates a fresh session (200); state machine advances per design
- [ ] User messages sanitized via `stripHtml` before store; state persisted to DB (not memory)
- [ ] Unit tests: state transitions, context growth, fresh session; Integration (full-cycle, in-memory mock of `@/lib/db`): two-call context growth end-to-end
- [ ] Gate passes: `npm run lint && npm run typecheck && npm run test:unit && npx vitest run __test__/integration` (unit ≥ 6, integration ≥ 3)

**Tests**: unit + integration
**Gate**: full
**Commit**: `feat(chat-assisted-registration): add POST /chat/continue-session`

---

### T6: `DELETE /user/[userId]` [P]

**What**: Public user-deletion route for suite cleanup.
**Where**: `src/app/user/[userId]/route.ts`
**Depends on**: T1 (reuses `flattenZodErrors`-style 404 body only if needed — else none)
**Reuses**: `EntityNotFoundException` from `@/lib/db`, 404 pattern from `escalation/[escalationId]` route
**Requirement**: CLEAN-01, CLEAN-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `DELETE /user/:id` → 204 on success, 404 `{ error: 'User not found' }` on unknown id
- [ ] Does not interfere with existing `POST /user` proxy route (`src/app/user/route.ts`)
- [ ] Unit tests: delete success (mocked db), 404 path
- [ ] Gate passes: `npm run test:unit` (test count: ≥ 3) + `npm run lint`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(chat-assisted-registration): add DELETE /user/[userId]`

---

### T7: Final gate — official Week 5 suite (local + deployed)

**What**: Prove the external suite passes end-to-end.
**Where**: external repo `week-5-integration-tests-asf0`
**Depends on**: T3, T4, T5, T6
**Reuses**: `npm run test:week5` script in the clone repo

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `npm run dev` running in this repo; `API_URL=http://localhost:3000 npm run test:week5` → 15/15 pass (clone repo)
- [ ] Deployed (Vercel or other) `API_URL=https://<your-app> npm run test:week5` → 15/15 pass
- [ ] Full in-repo gates green: `npm run format && npm run lint && npm run typecheck && npm run test:unit && npx vitest run __test__/integration`
- [ ] EPIC 14 tests still green: `npm run test:unit` includes `user-register-chat`/coach/escalation files — no regressions

**Tests**: e2e (external)
**Gate**: external

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  T1 [P] ──┐
  T2 [P] ──┤
Phase 2 (Parallel):
  ├── T3 [P]  } depend on T1
  ├── T4 [P]  } depend on T1
  ├── T5 [P]  } depend on T1 + T2
  └── T6 [P]  } depend on T1
Phase 3 (Sequential):
  T7 (needs all of T3-T6)
```

**Parallelism constraint:** Tasks T1-T6 are order-free within their phase ([P] valid — per-file mocked stores are parallel-safe per the Parallelism Assessment). T7 runs sequentially against one live server (external suite is NOT parallel-safe).

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Schemas + formatter | 4 small files, one concept each | ✅ Granular |
| T2: Model + migration | 1 model + 1 migration | ✅ Granular |
| T3: chat-assisted route | 1 endpoint | ✅ Granular |
| T4: escalate-registration route + handler | 2 cohesive files (route + handler) | ✅ Granular |
| T5: continue-session route + repository | 2 cohesive files (route + repository) | ✅ Granular |
| T6: DELETE user route | 1 endpoint | ✅ Granular |
| T7: Final gate | 1 acceptance run | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | none | T1 root | ✅ Match |
| T2 | none | T2 root | ✅ Match |
| T3 | T1 | T3 ← T1 | ✅ Match |
| T4 | T1 | T4 ← T1 | ✅ Match |
| T5 | T1, T2 | T5 ← T1, T2 | ✅ Match |
| T6 | T1 | T6 ← T1 | ✅ Match |
| T7 | T3-T6 | T7 ← T3..T6 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | schemas + formatter (domain) | unit | unit | ✅ OK |
| T2 | Prisma model/migration | none (build gate) | none + build gate | ✅ OK |
| T3 | route handler | unit | unit | ✅ OK |
| T4 | route handler + domain logic | unit | unit | ✅ OK |
| T5 | route handler + repository | unit + integration | unit + integration | ✅ OK |
| T6 | route handler | unit | unit | ✅ OK |
| T7 | — (external suite run) | e2e (external) | e2e external | ✅ OK |
