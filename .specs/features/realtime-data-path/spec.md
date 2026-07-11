# Real-Time Data Path Specification

**Epic**: SCRUM-17 — EPIC 3 — Real-Time Data Transmission & Analysis
**Product mapping**: `docs/product/epic-3-realtime-data-path.md` (PRFAQ 1.4 Step 4)
**Slice**: `.specs/features/realtime-data-path/`
**Depends on**: `.specs/features/pass-through-api/` (shared `proxyToStedi`, `/login`, `/user`, `/customer`)
**Related TDD**: `docs/engineering/tdd/2026-07-stedi-voice-ivr.md` (STEDI contract; V1 no dedicated queue)
**STEDI OpenAPI**: [https://dev.stedi.me/openapi-ui/](https://dev.stedi.me/openapi-ui/)

## Problem Statement

STEDI Voice needs a reliable path from IoT sensor activity to a balance index score
without building a new scoring engine or message bus. PRFAQ Step 4 (“Data Transmission
& Analysis”) and Assignment 1.7 require this API to forward step data to STEDI and
return STEDI’s risk score. The IVR TDD also needs observation of recent device updates
so a future voice flow can confirm readiness and completion. Today `/rapidsteptest` and
`/riskscore/{email}` already pass through; `/sensorUpdates` and
`/devices/updates/recent` are missing, and the epic’s Jira tasks still describe Kafka
as if it were V1 work.

## Goals

- [ ] Document and enforce the V1 contract: STEDI owns ingestion and scoring; this API
      pass-throughs; no Kafka/SNS/SQS/EventBridge in this slice.
- [ ] `POST /rapidsteptest` and `POST /sensorUpdates` forward authenticated sensor
      payloads to STEDI and return STEDI’s real status and body.
- [ ] `GET /devices/updates/recent` forwards query string + session token to STEDI and
      returns STEDI’s real status and body (IVR readiness/poll).
- [ ] `GET /riskscore/{email}` continues to return STEDI’s JSON score body with
      URL-encoded email and forwarded session token.
- [ ] Integration tests prove the Assignment 1.7 data path
      (login → customer → rapidsteptest → riskscore) against a deployed `API_URL`.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Kafka / SNS / SQS / EventBridge / local workers | PRFAQ “next steps”; IVR TDD defers to V2 |
| Local mobility/risk score algorithm | STEDI computes score; pass-through only |
| Twilio IVR webhooks / `call_session` | Epics 1–2 / later IVR slices |
| Clinician consent endpoints | Epic 5 |
| Assignment Step 2 double-write / Step 3 cut-over | Separate migration slices |
| Changing request/response shapes | Pass-through must not transform STEDI payloads |
| NextAuth / `getSession()` on these routes | STEDI `suresteps.session.token` is the auth boundary |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Queue in V1 | None — reuse STEDI pipeline + poll `/devices/updates/recent` | Matches IVR TDD Future Considerations (V2+) | y |
| Scoring owner | STEDI via `/riskscore/{email}` | Assignment 1.7 + OpenAPI; no local scorer | y |
| Proxy implementation | Reuse `proxyToStedi` in `src/lib/stedi-api.ts` | Already used by pass-through routes | y |
| Base URL | `ENV_VARS.STEDI_API_BASE_URL` (default `https://dev.stedi.me`) | Pass-through-api foundations | y |
| Auth | Forward `suresteps.session.token`; do not call `getSession()` | Same as pass-through-api | y |
| `/devices/updates/recent` query | Forward caller query string unchanged (e.g. `seconds=N`) | TDD uses `?seconds=N`; pass-through must not invent params | y |
| `/sensorUpdates` body | Forward raw body + Content-Type verbatim | OpenAPI “Send Sensor Updates”; no local schema gate in this slice | y |
| Existing `/rapidsteptest` + `/riskscore` | Keep behavior; add tests/docs coverage as needed | Already implemented under `src/app/` | y |
| Logging | Never log session token, stepPoints, or raw sensor bodies | CONVENTIONS + TDD | y |

**Open questions:** none.

## User Stories

### P1: Adopt STEDI sensor contracts (no new queue) ⭐ MVP

**User Story**: As a developer, I want the Epic 3 data path documented and wired only
through STEDI pass-through contracts, so we do not introduce a V1 message bus.

**Why P1**: Prevents scope creep from outdated Kafka-oriented Jira wording; anchors
all endpoint work on one shared proxy.

**Acceptance Criteria**:

1. WHEN the slice docs are inspected THEN they SHALL state that V1 uses STEDI
   pass-through only and SHALL NOT require Kafka, SNS, SQS, or EventBridge.
2. WHEN sensor/score routes are implemented THEN they SHALL call `proxyToStedi` (or
   an equivalent thin wrapper over it) and SHALL read the base URL only via
   `ENV_VARS.STEDI_API_BASE_URL`.
3. WHEN README documents API routes THEN it SHALL list the Epic 3 STEDI data-path
   endpoints and note that scoring remains on STEDI.

**Independent Test**: Grep of slice `spec.md` / `design.md` and route handlers shows
`proxyToStedi` + `STEDI_API_BASE_URL` and no new queue client dependency in
`package.json` for this slice.

---

### P1: Pass-through IoT step ingestion ⭐ MVP

**User Story**: As an authenticated caller, I want to save step/sensor data through
this API so STEDI can analyze it for scoring.

**Why P1**: PRFAQ Step 4 transmission; Assignment 1.7 `/rapidsteptest`; OpenAPI
`/sensorUpdates`.

**Acceptance Criteria**:

1. WHEN the caller sends `POST /rapidsteptest` with `suresteps.session.token` and a
   step-test body THEN the system SHALL forward body + header to
   `${STEDI_API_BASE_URL}/rapidsteptest` and return STEDI’s status and body
   (successful body text `Saved` when STEDI returns it).
2. WHEN the caller sends `POST /sensorUpdates` with `suresteps.session.token` and a
   sensor-update body THEN the system SHALL forward body + header to
   `${STEDI_API_BASE_URL}/sensorUpdates` and return STEDI’s status and body.
3. WHEN STEDI returns a non-2xx status THEN the system SHALL return that same status
   and SHALL NOT fabricate success bodies.
4. WHEN the upstream throws (network/timeout) THEN the system SHALL log without the
   token or payload and return a generic upstream failure response without leaking
   stack traces.
5. WHEN logging THEN the system SHALL NOT log `suresteps.session.token`,
   `stepPoints`, or raw sensor bodies.

**Independent Test**: Unit tests assert `proxyToStedi` is invoked with
`/rapidsteptest` and `/sensorUpdates` and `forwardSessionToken: true`. Manual or
integration call with a valid token returns STEDI’s real status.

---

### P1: Observe real-time device updates ⭐ MVP

**User Story**: As an IVR (or test) caller, I want to read recent device updates so I
can confirm the IoT device is active without a local event stream.

**Why P1**: IVR TDD readiness/poll path (`PRD-SV-009`…`011`); replaces “real-time
processing” Kafka wording with STEDI observation.

**Acceptance Criteria**:

1. WHEN the caller sends `GET /devices/updates/recent` with
   `suresteps.session.token` and an optional query string THEN the system SHALL
   forward the token and the same query string to
   `${STEDI_API_BASE_URL}/devices/updates/recent` and return STEDI’s status and body.
2. WHEN the query string includes `seconds=N` THEN the upstream URL SHALL include
   that same `seconds` parameter unchanged.
3. WHEN STEDI returns a non-2xx status THEN the system SHALL return that same status.
4. WHEN the upstream throws THEN the system SHALL log without the token and return a
   generic upstream failure response without leaking stack traces.

**Independent Test**: Unit test builds a request with `?seconds=30` and asserts
`proxyToStedi` path/query forwarding includes `seconds=30`.

---

### P1: Pass-through mobility/risk score ⭐ MVP

**User Story**: As an authenticated caller, I want to retrieve the STEDI risk /
balance index score for a customer email so IVR or clients can announce results.

**Why P1**: PRFAQ Step 5 retrieval; Assignment 1.7 terminal step; `PRD-SV-012`…`013`.

**Acceptance Criteria**:

1. WHEN the caller sends `GET /riskscore/{email}` with `suresteps.session.token`
   THEN the system SHALL URL-encode `email` and forward to
   `${STEDI_API_BASE_URL}/riskscore/{encodedEmail}` with the header.
2. WHEN STEDI returns `200` with a JSON score body THEN the system SHALL return
   `200` with that JSON body.
3. WHEN STEDI returns a non-2xx status THEN the system SHALL return that same status.
4. WHEN the upstream throws THEN the system SHALL log without the token and return a
   generic upstream failure response without leaking stack traces.

**Independent Test**: Existing unit coverage for email encoding remains green; after
saving valid step data, `GET /riskscore/{email}` returns JSON with a numeric `score`.

---

### P1: Validate data path with integration tests ⭐ MVP

**User Story**: As a team, I want automated integration tests against a deployed API
so the Epic 3 / Assignment 1.7 quality gate proves step save → score works.

**Why P1**: Assignment 1.7 rubric; CICD quality gate; SCRUM-22.

**Acceptance Criteria**:

1. WHEN `API_URL` points at a deployment of this API THEN
   `npm run test:integration` (or the repo’s equivalent integration command) SHALL
   exercise create-user → login → create-customer → `POST /rapidsteptest` →
   `GET /riskscore/{email}` against that deployment (not directly against
   `dev.stedi.me` as the public entrypoint).
2. WHEN step data is saved with a valid 30-point payload THEN the subsequent risk
   score response SHALL include a numeric `score` field.
3. WHEN documenting the gate THEN README or CI docs SHALL state that repository
   variable / env `API_URL` must be the team’s Vercel (or equivalent) public URL.

**Independent Test**: With a valid `API_URL`, integration suite exits 0; failing
proxy would fail the rapidsteptest or riskscore assertion.

## Edge Cases

- WHEN `Content-Type` is `application/text` on `/rapidsteptest` (integration-test
  quirk) THEN the route SHALL forward that Content-Type unchanged.
- WHEN email contains `+`, `/`, or `#` THEN `/riskscore/{email}` SHALL encode before
  building the upstream path.
- WHEN `/devices/updates/recent` has no query string THEN the upstream path SHALL
  still be `/devices/updates/recent` with no invented default `seconds`.
- WHEN STEDI returns an empty or non-JSON body for score THEN pass-through SHALL
  still return STEDI’s status and body verbatim (no local parse/repair).

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| RDP-01 | P1: Adopt STEDI contracts — no V1 queue | Tasks | Pending |
| RDP-02 | P1: Adopt STEDI contracts — use `proxyToStedi` + env | Tasks | Pending |
| RDP-03 | P1: Adopt STEDI contracts — README documents endpoints | Tasks | Pending |
| RDP-04 | P1: Ingestion — `POST /rapidsteptest` forward + `Saved` | Tasks | Pending |
| RDP-05 | P1: Ingestion — `POST /sensorUpdates` forward | Tasks | Pending |
| RDP-06 | P1: Ingestion — non-2xx fidelity + safe logging | Tasks | Pending |
| RDP-07 | P1: Observe — `GET /devices/updates/recent` + query forward | Tasks | Pending |
| RDP-08 | P1: Observe — upstream failure handling | Tasks | Pending |
| RDP-09 | P1: Score — `GET /riskscore/{email}` encode + forward | Tasks | Pending |
| RDP-10 | P1: Score — JSON score body passthrough | Tasks | Pending |
| RDP-11 | P1: Validate — integration flow against `API_URL` | Tasks | Pending |
| RDP-12 | P1: Validate — numeric score after step save | Tasks | Pending |

**ID format:** `RDP-NN` (Real-time Data Path).

**Status values:** Pending → In Design → In Tasks → Implementing → Verified.

## Success Criteria

- [ ] No new queue dependency is introduced for Epic 3 V1.
- [ ] `POST /rapidsteptest`, `POST /sensorUpdates`, `GET /devices/updates/recent`,
      and `GET /riskscore/{email}` pass through to STEDI with session-token forwarding
      where required.
- [ ] Integration tests against deployed `API_URL` prove step save → numeric score.
- [ ] SCRUM-18…22 summaries/descriptions match this slice (no Kafka-as-V1 wording).
