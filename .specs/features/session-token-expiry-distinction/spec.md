# Session Token Expiry Distinction Specification

**Source**: Review comment by ljm234 on [PR #64](https://github.com/John-Keitel/CSAI420_Smoking-Snakes/pull/64) (merged) — `src/app/api/notifications/register/route.ts` returns a generic 401 without distinguishing expired from invalid session tokens, complicating client-side debugging.
**Branch (planned)**: `fix/session-token-expiry-distinction`

## Problem Statement

`POST /api/notifications/register` authenticates via the `suresteps.session.token` header. Every session-validation failure currently produces the same `401 { error: ... }`, and the shared validator `validateSureStepsSession` (src/lib/auth/suresteps.ts) never checks the JWT `exp` claim — even though tokens issued by `/auth/signin` carry a 30-day `exp` (src/lib/auth/index.ts:42). Expired tokens are therefore indistinguishable from invalid ones, for clients and servers alike.

## Goals

- [ ] `validateSureStepsSession` rejects tokens whose `exp` claim is in the past with a distinct reason (`Session token expired`)
- [ ] `POST /api/notifications/register` returns a stable machine-readable `code` (`SESSION_TOKEN_EXPIRED` vs `UNAUTHORIZED`) so clients can branch on the cause
- [ ] Zero regression: non-JWT / no-`exp` tokens, other failure reasons, and all existing status codes behave exactly as today

## Out of Scope

| Feature | Reason |
| --- | --- |
| JWT signature verification | Legacy STEDI tokens are signed with STEDI's secret, not `AUTH_SECRET`; verification would break real clients. Claims-only simulation is preserved |
| Expiry of the app's own DB-backed sessions | `getSession()` already enforces 30-day session expiry server-side (src/lib/auth/index.ts:88-93) |
| Refreshing / re-issuing tokens | No session-refresh flow exists; out of scope |
| Distinguishable 401 on other suresteps consumers | Validator reason strings still flow through their `{ error: reason }` bodies; `code` field added only on the reviewed endpoint |
| Non-401 statuses (e.g. 410) | 401 is the correct status for both invalid and expired; distinction lives in the body |

## Assumptions & Decisions

| Assumption / decision | Chosen default | Confirmed? |
| --- | --- | --- |
| `exp` semantics | JWT standard epoch **seconds**; expired when `claims.exp * 1000 <= Date.now()` | y |
| Backward compatibility | Only reject when an `exp` claim exists and is in the past; tokens without `exp` (non-JWT legacy tokens) keep passing | y |
| Malformed `exp` (non-numeric) | Treated as absent → token passes (simulated validation; logged, not fatal) | y |
| Clock skew | None applied (single-server simulation) | y |
| HTTP status | Both expired and invalid return 401; distinction via body `code` | y |
| Error body | `{ error: <message>, code: <CODE> }` — additive, existing `error` key unchanged | y |
| Response mapping | `code: 'SESSION_TOKEN_EXPIRED'` for the expired reason; `'UNAUTHORIZED'` for all other auth failures on the register endpoint | y |
| No signature check in tests | Validator reads claims only, so tests craft JWTs signed with any secret (jose `SignJWT`) | y |
| Unit test command | `npm run test:unit` (vitest) — `npm test` is Playwright e2e in this repo | y |

**Open questions:** none — all resolved or logged above.

## User Stories

### P1: Reject expired session tokens in the shared validator ⭐ MVP

**User Story**: As an API client, I want an expired session token to be reported distinctly so that the cause of a 401 is clear.

**Acceptance Criteria**:

1. WHEN a session token's decoded JWT claims contain an `exp` claim in the past THEN `validateSureStepsSession` SHALL return `{ ok: false, reason: 'Session token expired' }`.
2. WHEN a session token's decoded claims contain an `exp` claim in the future THEN validation SHALL succeed and resolve identity exactly as today.
3. WHEN a session token is not a JWT or has no `exp` claim THEN validation SHALL behave exactly as today (no new rejection).
4. WHEN the token header is missing or empty THEN the existing reasons (`Missing suresteps.session.token header`, `Empty session token`) SHALL be unchanged.

**Independent Test**: `npm run test:unit -- suresteps` — new `__test__/unit/suresteps.test.ts` covers all four cases.

---

### P1: Distinguishable 401 on the register endpoint ⭐ MVP

**User Story**: As a mobile client calling `POST /api/notifications/register`, I want the 401 body to identify token expiry so I can prompt re-login instead of showing a generic error.

**Acceptance Criteria**:

1. WHEN the register endpoint rejects an expired session token THEN the response SHALL be `401` with body `{ error: 'Session token expired', code: 'SESSION_TOKEN_EXPIRED' }`.
2. WHEN the register endpoint rejects any other session-validation failure (missing/empty token, identity missing) THEN the response SHALL be `401` with body containing `code: 'UNAUTHORIZED'`.
3. WHEN session validation succeeds THEN the existing behavior (201 register/upsert, 404 unknown user, 422 invalid body) SHALL be unchanged.

**Independent Test**: `npm run test:unit -- notifications-register-route` and `npm run test:integration` (push-notifications suite) — expired-token case uses a client-crafted JWT, no `AUTH_SECRET` needed.

---

## Edge Cases

- WHEN `exp` is present but not a finite number THEN the validator SHALL treat it as absent (token passes; backward compatible).
- WHEN `exp` equals `now` (boundary) THEN the token SHALL be treated as expired (`exp * 1000 <= Date.now()`).
- WHEN a token has an expired `exp` but the request also carries `suresteps.user.id` THEN the expired reason SHALL still win (expiry checked before identity resolution).

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| SES-01 | P1: Reject expired tokens | Design | Pending |
| SES-02 | P1: Reject expired tokens | Design | Pending |
| SES-03 | P1: Reject expired tokens | Design | Pending |
| SES-04 | P1: Reject expired tokens | Design | Pending |
| SES-05 | P1: Distinguishable 401 | Design | Pending |
| SES-06 | P1: Distinguishable 401 | Design | Pending |
| SES-07 | P1: Distinguishable 401 | Design | Pending |

**Coverage:** 7 total, 0 mapped to tasks, 7 unmapped ⚠️ (mapping lands in tasks.md)

## Success Criteria

- [ ] `validateSureStepsSession` returns `Session token expired` for past-`exp` tokens and nothing else changes for other tokens
- [ ] Register endpoint 401s carry `SESSION_TOKEN_EXPIRED` / `UNAUTHORIZED` codes per cause
- [ ] All existing unit tests pass unchanged; new unit + integration tests prove the distinction; `npm run lint` clean
