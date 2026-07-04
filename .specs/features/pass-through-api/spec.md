# Pass-Through API Specification

**Assignment**: 1.7 Pass-Through API and Integration Tests — Step 1 (pass-through only)
**Source**: `ASSIGNMENT.md` § "What Your API Needs to Do"; PDF `1.7 Pass-Through API and Integration Tests.pdf`
**Slice**: `.specs/features/pass-through-api/`
**Related TDD**: `docs/engineering/tdd/2026-07-stedi-voice-ivr.md` (STEDI API contract summary)

## Problem Statement

This repo (`cs420-api`) must become a "bridge" in front of the legacy STEDI cloud API
(`https://dev.stedi.me`). Today the only existing pass-through handlers live in the legacy
root `app/` tree: they hardcode the STEDI base URL, ignore the repo's error/logging/env
conventions, and `POST /user` even masks upstream failures by always returning `200`. We
need a conventions-compliant pass-through layer that forwards five user-facing endpoints
to STEDI and returns STEDI's real status and body so the Assignment 1.7 integration tests
(canonical STEDI flow: create user → login → create customer → save step data → get risk
score) pass against a deployment of this API.

## Goals

- [ ] Five pass-through endpoints serve the Assignment 1.7 contract from this repo's deployment.
- [ ] Every endpoint forwards the request to STEDI and returns STEDI's real HTTP status and body (no masking).
- [ ] The session-token header (`suresteps.session.token`) is forwarded on the authenticated endpoints and never logged.
- [ ] The STEDI base URL is a Zod-validated env var, not a hardcoded constant.
- [ ] Endpoints live under `src/app/` following `CONVENTIONS.md`; the legacy root `app/` stubs are removed.
- [ ] Endpoints handle upstream network/timeout errors as `500` generic without leaking stack traces.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| --- | --- |
| Step 2 — double-writing to a new local database | Assignment Step 2; separate slice once Step 1 is green. |
| Step 3 — cutting over away from STEDI | Assignment Step 3 (optional); separate slice. |
| Integration / e2e tests | Deferred per user instruction this session; a later session will write/verify tests against a Vercel deployment. |
| Changing the request or response shape | Pass-through must not transform payload; STEDI remains source of truth for data and scoring. |
| NextAuth / `getSession()` gating on these routes | These routes proxy the STEDI `suresteps.session.token` header, not the repo's own auth. They are intentionally open proxies to STEDI. |
| Caching, rate limiting, retry, idempotency keys | Not required by Assignment 1.7 Step 1; STEDI owns those semantics. |
| New Prisma models or migrations | Pass-through owns no persistence; `call_session` etc. belong to the IVR TDD and future slices. |
| AI feedback, Twilio webhooks, IVR call flow | Belong to the STEDI Voice IVR TDD, not this pass-through slice. |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here — nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Code location | Rebuild the five handlers under `src/app/` and delete the legacy root `app/` stubs for the same paths. | `CONVENTIONS.md`: "new work goes in `src/`; the root `app/` is legacy." Avoids Next.js duplicate-route ambiguity between two `app/` trees. | y |
| Status fidelity | Proxy STEDI's real status + body verbatim; non-2xx surfaces as that status. | Assignment says "Status 200 if successful" (implying non-200 on failure); the legacy `/user` `always-200` bug must be fixed so the integration test can detect real failures. | y |
| STEDI base URL config | New Zod-validated `STEDI_API_BASE_URL` env var (default `https://dev.stedi.me`) in `src/lib/env-vars.ts`, plus `.env.example` + README entries. | `CONVENTIONS.md`: "never read `process.env.X` directly in application code." | y |
| Upstream failure handling | Wrap upstream `fetch` in `try/catch`; map STEDI 4xx/5xx through `HttpException(status, message)` to `{ error }` + that status; on network/timeout log via `getAppLogger` and return `500 { error: 'Server Error' }`. | Matches `CONVENTIONS.md` error-handling summary; never leaks stack traces. | y |
| Auth boundary | These routes do **not** call `getSession()`. They forward `suresteps.session.token` to STEDI and rely on STEDI to authorize. | Pass-through only; the repo's own NextAuth is unrelated to STEDI's session token. | y |
| Slice scope | Step 1 of the assignment only; tests deferred. | User instruction. | y |
| `/riskscore/{email}` path param encoding | `encodeURIComponent(email)` when building the upstream URL. | Mirrors the legacy handler and prevents URL/path injection. | y |
| Request body forwarding | Forward `request.text()` unchanged with the original `Content-Type`; do not parse/re-serialize and risk reordering. | Pass-through must not alter payload; avoids validation drift between repo's Zod schemas and STEDI's contract. | y |
| `Content-Type` for upstream | `request.headers.get('Content-Type') ?? 'application/json'`. | Mirrors legacy handlers; tolerates the integration test's `application/text` quirk on `/login` and `/rapidsteptest`. | y |
| Logging content | Log only call path, upstream status code, and latency category. Never log the session token, OTP, DOB, password, full phone, or raw body. | `CONVENTIONS.md` + TDD logging rules. | y |

**Open questions:** none — all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P1: Foundations — STEDI base URL env var + remove legacy handlers ⭐ MVP

**User Story**: As a developer, I want the STEDI base URL to come from a validated env var and the legacy root `app/` stubs gone, so all pass-through routes use one configured, conventions-compliant base.

**Why P1**: Enables all five endpoint stories; removes the duplicate-route ambiguity and the hardcoded-constant violation before any handler logic lands.

**Acceptance Criteria**:

1. WHEN the application boots THEN `ENV_VARS` SHALL expose a Zod-validated `STEDI_API_BASE_URL` (string URL) defaulting to `https://dev.stedi.me` when unset.
2. WHEN `STEDI_API_BASE_URL` is not a valid URL THEN the process SHALL `process.exit(1)` at boot with the schema name printed, consistent with the other `env-vars.ts` groups.
3. WHEN `.env.example` is inspected THEN it SHALL contain `STEDI_API_BASE_URL="https://dev.stedi.me"` under a clearly labeled `# STEDI` section.
4. WHEN the legacy root `app/{user,login,customer,rapidsteptest,riskscore}` directories are inspected THEN they SHALL NOT exist; their pass-through responsibilities have moved to `src/app/`.

**Independent Test**: Boot the app with `STEDI_API_BASE_URL` unset → succeeds using the default; boot with `STEDI_API_BASE_URL="notaurl"` → exits non-zero. `git ls-files app/user app/login app/customer app/rapidsteptest app/riskscore` returns nothing.

---

### P1: Create a User — `POST /user` ⭐ MVP

**User Story**: As a caller, I want to `POST /user` with the user-creation payload and receive STEDI's real status, so user creation success is reported truthfully.

**Why P1**: First step of the canonical STEDI flow; the legacy `/user` masking bug must be fixed.

**Acceptance Criteria**:

1. WHEN the caller sends `POST /user` with the Assignment-defined user body THEN the system SHALL forward the body and `Content-Type` to `${STEDI_API_BASE_URL}/user` and return STEDI's response status to the caller.
2. WHEN STEDI returns `200` THEN the system SHALL return `200` with an empty body.
3. WHEN STEDI returns a non-2xx status (e.g., `409` duplicate) THEN the system SHALL return that same status (through `HttpException`) with `{ error: <message> }` and not force `200`.
4. WHEN the upstream call throws (network/timeout) THEN the system SHALL log via the route logger and return `500 { error: 'Server Error' }` without leaking the stack trace.

**Independent Test**: `POST /user` with a fresh email → expect `200`; repeat with the same email → expect STEDI's non-2xx (e.g., `409`), not `200`.

---

### P1: Log In — `POST /login` ⭐ MVP

**User Story**: As a caller, I want to `POST /login` with `{ userName, password }` and receive the STEDI session token as text, so I can use it as `suresteps.session.token` on the authenticated endpoints.

**Why P1**: Unblocks create-customer, save-step, and get-score stories; the token is the gateway to the rest of the flow.

**Acceptance Criteria**:

1. WHEN the caller sends `POST /login` with a valid `{ userName, password }` body THEN the system SHALL forward it to `${STEDI_API_BASE_URL}/login` and return STEDI's status.
2. WHEN STEDI returns `200` with a text token THEN the system SHALL return `200` with the token text and `Content-Type: text/plain`.
3. WHEN STEDI returns a non-2xx status THEN the system SHALL return that same status via `HttpException` with `{ error: <message> }`.
4. WHEN the upstream throws THEN the system SHALL log and return `500 { error: 'Server Error' }` and SHALL NOT log the password or token.

**Independent Test**: After creating a user, `POST /login` with matching credentials → expect `200` and a non-empty text token; wrong password → expect STEDI's non-2xx.

---

### P1: Create a Customer — `POST /customer` ⭐ MVP

**User Story**: As an authenticated caller, I want to `POST /customer` with the customer payload and the session token header, so STEDI creates the customer record linked to my user.

**Why P1**: Required before saving any step data for that customer (STEDI's flow).

**Acceptance Criteria**:

1. WHEN the caller sends `POST /customer` with `suresteps.session.token` and the Assignment-defined customer body THEN the system SHALL forward both (body + the session-token header) to `${STEDI_API_BASE_URL}/customer` and return STEDI's status.
2. WHEN STEDI returns `200` THEN the system SHALL return `200`.
3. WHEN the `suresteps.session.token` header is absent THEN the system SHALL still forward to STEDI (STEDI will reject with its own non-2xx) and return STEDI's status through `HttpException`; it SHALL NOT synthesize its own auth error.
4. WHEN STEDI returns a non-2xx status THEN the system SHALL return that same status via `HttpException` with `{ error: <message> }`.
5. WHEN the upstream throws THEN the system SHALL log (never the token) and return `500 { error: 'Server Error' }`.

**Independent Test**: With a valid session token, `POST /customer` with the matching customer payload → expect `200`; without the token header → expect STEDI's auth failure status (not `200`).

---

### P1: Save Step Data — `POST /rapidsteptest` ⭐ MVP

**User Story**: As an authenticated caller, I want to `POST /rapidsteptest` with the step-test payload and session token header, and receive the literal text `Saved`, so the step data is recorded for scoring.

**Why P1**: Feeds the risk-score computation; the integration test asserts the literal `Saved` body.

**Acceptance Criteria**:

1. WHEN the caller sends `POST /rapidsteptest` with `suresteps.session.token` and the step-test body THEN the system SHALL forward both to `${STEDI_API_BASE_URL}/rapidsteptest`.
2. WHEN STEDI returns `200` with body text `Saved` THEN the system SHALL return `200` with the body text exactly `Saved`.
3. WHEN STEDI returns a non-2xx status THEN the system SHALL return that same status via `HttpException` with `{ error: <message> }` and SHALL NOT fabricate `Saved`.
4. WHEN the upstream throws THEN the system SHALL log (never the token or `stepPoints`) and return `500 { error: 'Server Error' }`.

**Independent Test**: With a valid token and a 30-point `stepPoints` array, `POST /rapidsteptest` → expect `200` and body exactly `Saved`.

---

### P1: Get Risk Score — `GET /riskscore/{email}` ⭐ MVP

**User Story**: As an authenticated caller, I want to `GET /riskscore/{email}` with the session token header, and receive JSON `{ "score": <number> }`, so I can read the balance index score for that customer.

**Why P1**: Terminal step of the canonical flow; the integration test asserts `data.score > 0`.

**Acceptance Criteria**:

1. WHEN the caller sends `GET /riskscore/{email}` with `suresteps.session.token` THEN the system SHALL URL-encode `email` and forward to `${STEDI_API_BASE_URL}/riskscore/{encodedEmail}` with the header.
2. WHEN STEDI returns `200` with a JSON score body THEN the system SHALL return `200` with that JSON body and `Content-Type` matching STEDI.
3. WHEN STEDI returns a non-2xx status THEN the system SHALL return that same status via `HttpException` with `{ error: <message> }`.
4. WHEN the upstream throws THEN the system SHALL log (never the token) and return `500 { error: 'Server Error' }`.

**Independent Test**: After saving valid step data, `GET /riskscore/{email}` with the token → expect `200` JSON with a numeric `score` field.

---

## Edge Cases

- WHEN two `app/` trees would both declare the same path THEN the legacy root `app/` handlers SHALL be removed so the `src/app/` handlers win unambiguously (Foundations AC-4) — verified by `git ls-files`.
- WHEN the caller omits `Content-Type` THEN the route SHALL default to `application/json` for the upstream `Content-Type` header (mirrors legacy behavior).
- WHEN the caller sends `application/text` (integration-test quirk on `/login`/`/rapidsteptest`) THEN the route SHALL forward that `Content-Type` to STEDI unchanged.
- WHEN STEDI returns a redirect (3xx) THEN the route SHALL forward it verbatim (status + `Location`) — pass-through does not follow redirects server-side.
- WHEN the upstream body is empty (e.g., `/user` success) THEN the route SHALL return an empty body with STEDI's status; not synthesize `{}`.
- WHEN the upstream returns a non-JSON body for `/riskscore` (unexpected shape) THEN the route SHALL still return STEDI's status and body text verbatim; pass-through does not parse the score.
- WHEN `STEDI_API_BASE_URL` has a trailing slash THEN the route SHALL NOT double-slash (use `new URL(path, base)` or trim) so the upstream target is well-formed.

---

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PTAPI-01 | P1: Foundations — env var + remove legacy | Design | Pending |
| PTAPI-02 | P1: Foundations — env var boot validation | Design | Pending |
| PTAPI-03 | P1: Foundations — `.env.example` entry | Design | Pending |
| PTAPI-04 | P1: Foundations — delete legacy root `app/` stubs | Design | Pending |
| PTAPI-05 | P1: `POST /user` — forward + status fidelity | Design | Pending |
| PTAPI-06 | P1: `POST /user` — fix always-200 bug | Design | Pending |
| PTAPI-07 | P1: `POST /user` — upstream failure → 500 | Design | Pending |
| PTAPI-08 | P1: `POST /login` — return token text 200 | Design | Pending |
| PTAPI-09 | P1: `POST /login` — non-2xx passthrough | Design | Pending |
| PTAPI-10 | P1: `POST /login` — never log password/token | Design | Pending |
| PTAPI-11 | P1: `POST /customer` — forward token header | Design | Pending |
| PTAPI-12 | P1: `POST /customer` — absent token → STEDI status | Design | Pending |
| PTAPI-13 | P1: `POST /rapidsteptest` — return literal `Saved` | Design | Pending |
| PTAPI-14 | P1: `POST /rapidsteptest` — never log stepPoints/token | Design | Pending |
| PTAPI-15 | P1: `GET /riskscore/{email}` — encode email + forward token | Design | Pending |
| PTAPI-16 | P1: `GET /riskscore/{email}` — pass JSON score body | Design | Pending |
| PTAPI-17 | All routes — try/catch + `HttpException` + logger per `CONVENTIONS.md` | Design | Pending |
| PTAPI-18 | All routes — never leak stack traces / raw upstream errors | Design | Pending |

**ID format:** `PTAPI-NN` (Pass-Through API).

**Status values:** Pending → In Design → In Tasks → Implementing → Verified.

**Coverage:** 18 total, 0 mapped to tasks yet (tasks.md comes after the spec is approved), 18 unmapped ⚠️

---

## Success Criteria

How we know the feature is successful:

- [ ] A deployment of this repo serves `/user`, `/login`, `/customer`, `/rapidsteptest`, and `/riskscore/{email}` and each forwards to STEDI returning STEDI's real status and body.
- [ ] Repeated `POST /user` with the same email surfaces STEDI's real non-2xx (the always-200 bug is gone).
- [ ] `POST /login` returns a usable token; that token drives `/customer`, `/rapidsteptest`, and `/riskscore/{email}` end-to-end against STEDI dev.
- [ ] `npm run lint` is clean; no `process.env` direct reads added; `STEDI_API_BASE_URL` is the single source of the base URL.
- [ ] The integration test's five-step flow (create user → login → create customer → save step → get score) runs against the deployment without masking failures.