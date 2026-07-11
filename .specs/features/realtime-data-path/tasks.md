# Real-Time Data Path Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

> **Repo override:** Execution is owned by the `sdd-execute-jira` session, NOT this planning session. This `tasks.md` is the handoff contract for that session. Do not run Execute here.

---

**Design**: `.specs/features/realtime-data-path/design.md`
**Status**: Draft
**Epic**: [SCRUM-17](https://csai420.atlassian.net/browse/SCRUM-17)

---

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| New/updated STEDI proxy routes | unit | Assert `proxyToStedi` path + `forwardSessionToken` | `__test__/unit/*-route.test.ts` | `npm run test:unit` (or project unit script) |
| Email encoding on riskscore | unit | Encoded path segment | `__test__/unit/riskscore-route.test.ts` | unit script |
| Assignment data path | integration | user→login→customer→rapidsteptest→riskscore vs `API_URL` | `__test__/integration_tests/IVR.test.ts` | `npm run test:integration` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit | yes | Mocked `proxyToStedi` | No shared mutable state |
| integration | no (shared STEDI + unique emails) | Sequential suite with unique test emails | Existing IVR.test.ts pattern |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Unit | After T1–T4 route work | Project unit test script covering `__test__/unit` |
| Integration | After T5 | `npm run test:integration` with `API_URL` set |
| Lint | After any `src/` change | `npm run lint` |

---

## Execution Plan

### Phase 1: Contracts + existing score/ingestion verify

```
T1 ──→ T2
T1 ──→ T4
```

T2 and T4 may run in parallel after T1 (docs/contract baseline).

### Phase 2: New observation + sensor routes

```
T1 ──→ T3
```

T3 can parallel T2/T4 after T1.

### Phase 3: Integration validation

```
(T2 ∧ T4) ──→ T5
```

T5 needs rapidsteptest + riskscore green; sensorUpdates / recent-updates unit coverage from T2/T3 should already be in.

---

## Task Breakdown

### T1: Adopt STEDI sensor contracts (no new queue in V1)

**Issue**: https://csai420.atlassian.net/browse/SCRUM-18

**What**: Confirm V1 uses STEDI pass-through only (no Kafka/SNS/SQS), document Epic 3 endpoints in README, and ensure handlers will use `proxyToStedi` + `ENV_VARS.STEDI_API_BASE_URL`.

**Where**: `README.md`, `docs/product/epic-3-realtime-data-path.md` (already present — link from README), no new queue packages in `package.json`

**Depends on**: None

**Requirement**: RDP-01, RDP-02, RDP-03

**Story points**: 1

**Done when**:

- [ ] README lists `/rapidsteptest`, `/sensorUpdates`, `/devices/updates/recent`, `/riskscore/{email}` as STEDI pass-through data-path routes
- [ ] README or epic doc states V1 has no dedicated queue; STEDI owns scoring
- [ ] `package.json` gains no Kafka/SNS/SQS/EventBridge client dependency for this task
- [ ] Gate: `npm run lint` clean for touched docs/config (or no lint regressions)

**Tests**: none (documentation / contract task) — Verifier checks docs + package.json
**Gate**: quick

---

### T2: Pass-through IoT step ingestion (`/rapidsteptest`, `/sensorUpdates`)

**Issue**: https://csai420.atlassian.net/browse/SCRUM-19

**What**: Keep `POST /rapidsteptest` pass-through correct; add `POST /sensorUpdates` thin proxy with session-token forwarding and safe logging.

**Where**: `src/app/rapidsteptest/route.ts`, `src/app/sensorUpdates/route.ts`, `__test__/unit/` route tests

**Depends on**: T1

**Requirement**: RDP-04, RDP-05, RDP-06

**Story points**: 2

**Done when**:

- [ ] `POST /sensorUpdates` exists under `src/app/` and calls `proxyToStedi` with `/sensorUpdates` and `forwardSessionToken: true`
- [ ] `POST /rapidsteptest` still forwards to `/rapidsteptest` with session token
- [ ] Unit tests assert both routes invoke `proxyToStedi` with expected paths
- [ ] Gate: unit tests for these routes pass; `npm run lint` clean

**Tests**: unit
**Gate**: unit

---

### T3: Observe real-time device updates (`/devices/updates/recent`)

**Issue**: https://csai420.atlassian.net/browse/SCRUM-20

**What**: Add `GET /devices/updates/recent` pass-through that forwards `suresteps.session.token` and the caller query string (e.g. `seconds=N`) to STEDI without colliding with local `/devices/[deviceId]` CRUD.

**Where**: `src/app/devices/updates/recent/route.ts`, `__test__/unit/` route test

**Depends on**: T1

**Requirement**: RDP-07, RDP-08

**Story points**: 2

**Done when**:

- [ ] Route lives at `src/app/devices/updates/recent/route.ts` (static `updates` segment)
- [ ] Query string is forwarded to STEDI unchanged
- [ ] Unit test covers `?seconds=30` forwarding and `forwardSessionToken: true`
- [ ] Gate: unit test passes; `npm run lint` clean

**Tests**: unit
**Gate**: unit

---

### T4: Pass-through mobility/risk score (`/riskscore/{email}`)

**Issue**: https://csai420.atlassian.net/browse/SCRUM-21

**What**: Verify `GET /riskscore/[email]` encodes email, forwards session token, and returns STEDI’s JSON score body; strengthen unit coverage if gaps remain.

**Where**: `src/app/riskscore/[email]/route.ts`, `__test__/unit/riskscore-route.test.ts`

**Depends on**: T1

**Requirement**: RDP-09, RDP-10

**Story points**: 1

**Done when**:

- [ ] Handler uses `encodeURIComponent(email)` on the upstream path
- [ ] `forwardSessionToken: true` (or equivalent header forward) is set
- [ ] Unit tests for encoding remain green
- [ ] Gate: unit tests pass; `npm run lint` clean

**Tests**: unit
**Gate**: unit

---

### T5: Validate data path with integration tests

**Issue**: https://csai420.atlassian.net/browse/SCRUM-22

**What**: Ensure Assignment 1.7 integration flow against deployed `API_URL` proves step save → numeric risk score; document `API_URL` requirement for CI/local runs.

**Where**: `__test__/integration_tests/IVR.test.ts`, `README.md` (or CI docs), repo env/docs for `API_URL`

**Depends on**: T2, T4

**Requirement**: RDP-11, RDP-12

**Story points**: 2

**Done when**:

- [ ] Integration suite covers login → customer → `POST /rapidsteptest` → `GET /riskscore/{email}` against `API_URL`
- [ ] Assertions require successful save and a numeric `score`
- [ ] Docs state `API_URL` must be the team deployment URL (not raw STEDI as the public entry)
- [ ] Gate: `npm run test:integration` passes when `API_URL` is configured (record evidence in execution trail)

**Tests**: integration
**Gate**: integration

---

## Traceability

| Task | Requirements | Points | Jira |
| --- | --- | --- | --- |
| T1 | RDP-01, RDP-02, RDP-03 | 1 | SCRUM-18 |
| T2 | RDP-04, RDP-05, RDP-06 | 2 | SCRUM-19 |
| T3 | RDP-07, RDP-08 | 2 | SCRUM-20 |
| T4 | RDP-09, RDP-10 | 1 | SCRUM-21 |
| T5 | RDP-11, RDP-12 | 2 | SCRUM-22 |
