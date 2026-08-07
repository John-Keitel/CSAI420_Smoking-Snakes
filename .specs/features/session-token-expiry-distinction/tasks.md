# Session Token Expiry Distinction Tasks

**Design**: Settled in spec.md (Assumptions & Decisions) — no separate design.md needed; choices are small, single-module, and backward compatible.
**Epic / Slice**: To be published via `/sdd-tasks-jira` (slice epic in Jira `SCRUM`).
**Branch (planned)**: `fix/session-token-expiry-distinction` — single slice branch; one atomic commit per task.
**Execution**: Runs in a separate session via `/sdd-execute-jira` — never inline with this planning session.

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found: `.specs/codebase/CONVENTIONS.md`, `package.json` scripts.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Domain/logic (`src/lib/auth/suresteps.ts`) | unit | All branches; 1:1 to SES-01..04; every listed edge case (missing/empty token, no-`exp`, non-numeric `exp`, past/current `exp`, unexpired) | `__test__/unit/suresteps.test.ts` (new) | `npm run test:unit` |
| Route (`src/app/api/notifications/register/route.ts`) | unit | All auth-failure paths in scope: SES-05, SES-06, SES-07 happy/error mapping | `__test__/unit/notifications-register-route.test.ts` | `npm run test:unit` |
| Route (deployed API) | integration | SES-05 expired-token 401 + `code`; regression on existing 401/404/422 cases | `__test__/integration_tests/push-notifications.test.ts` | `npm run test:integration` |
| Config / entity | none | — (build gate only) | — | `npm run typecheck` |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| Unit (validator, new file) | Yes | Pure function over `NextRequest` headers; no mocks or shared state | `__test__/unit/` files use per-test fixtures |
| Unit (register route) | Yes | `vi.mock` of `@/lib/auth/suresteps`, `@/lib/db`, `@/lib/logger` per file | `__test__/unit/notifications-register-route.test.ts` |
| Integration | No | Shared deployed DB + real user created in `beforeAll`; sequential suite | `__test__/integration_tests/push-notifications.test.ts` requires `API_URL` |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After T1/T2 unit changes | `npm run test:unit -- suresteps.test.ts notifications-register-route.test.ts` |
| Lint / type | Before commit (always) | `npm run lint` && `npm run typecheck` |
| Full | After integration-test changes (needs deployed API + `API_URL`; run manually) | `npm run test:integration` |

## Execution Plan

### Phase 1: Validator (Sequential)

```
T1
```

### Phase 2: Route (Sequential)

```
T1 → T2
```

## Task Breakdown

### T1: Reject expired session tokens in the shared validator

**What**: Add an `exp`-claim check to `validateSureStepsSession` returning `{ ok: false, reason: 'Session token expired' }` when `claims.exp` is a finite number and `claims.exp * 1000 <= Date.now()`; check runs after the token-emptiness checks and before identity resolution; tokens without a finite `exp` are unaffected.
**Where**: `src/lib/auth/suresteps.ts` (modify)
**Depends on**: None
**Reuses**: Existing `decodeJwtClaims`; `jose` only in tests (already a dependency)
**Requirement**: SES-01, SES-02, SES-03, SES-04
**Branch**: `fix/session-token-expiry-distinction` (slice root)

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `validateSureStepsSession` returns `Session token expired` for a token whose `exp` is past or exactly now
- [ ] Unexpired `exp`, absent `exp`, non-JWT tokens, missing/empty header all behave exactly as before
- [ ] New `__test__/unit/suresteps.test.ts` passes (1:1 to SES-01..04 + edge cases: non-numeric `exp`, `exp` == now, expired-with-identity-header)
- [ ] Gate passes: `npm run test:unit -- suresteps.test.ts` && `npm run lint` && `npm run typecheck`
- [ ] Test count: ~6-7 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick + lint/type
**Commit**: `fix(suresteps): reject expired session tokens`

---

### T2: Distinguish expired vs invalid 401s on the register endpoint

**What**: In `POST /api/notifications/register`, map session-validation failures to a stable code in the 401 body: `SESSION_TOKEN_EXPIRED` when `sessionCheck.reason === 'Session token expired'`, otherwise `UNAUTHORIZED`; keep status 401 and the existing `error` message; success-path behavior unchanged.
**Where**: `src/app/api/notifications/register/route.ts` (modify), `__test__/unit/notifications-register-route.test.ts` (extend), `__test__/integration_tests/push-notifications.test.ts` (extend)
**Depends on**: T1
**Reuses**: Existing `validateSession` / `errorResponse` structure; test JWTs crafted with `SignJWT` from `jose` (any secret — claims-only validation)
**Requirement**: SES-05, SES-06, SES-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Expired token → `401 { error: 'Session token expired', code: 'SESSION_TOKEN_EXPIRED' }`
- [ ] Other auth failures → `401` with `code: 'UNAUTHORIZED'`; `error` message unchanged
- [ ] Unit tests extended: expired-reason mock → code assertion; generic failure → `UNAUTHORIZED`; existing 201/404/422 tests unchanged and passing
- [ ] Integration test added: client-crafted expired JWT (signed with any secret) → 401 + `SESSION_TOKEN_EXPIRED`; existing cases still pass
- [ ] Gate passes: `npm run test:unit -- notifications-register-route.test.ts` && `npm run lint` && `npm run typecheck`; `npm run test:integration` (manual, needs deployed API)
- [ ] Test count: existing suite + ~2-3 new assertions pass (no silent deletions)

**Tests**: unit + integration
**Gate**: quick + lint/type; full (manual)
**Commit**: `fix(notifications): distinguish expired session tokens in register 401`

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Validator exp check | 1 function in 1 file | ✅ Granular |
| T2: Route error-code mapping | 1 route + its tests | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Phase 1 root | ✅ Match |
| T2 | T1 | `T1 → T2` | ✅ Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Domain logic (suresteps) | unit | unit (new `suresteps.test.ts`) | ✅ OK |
| T2 | Route (register) + integration | unit + integration | unit + integration | ✅ OK |
