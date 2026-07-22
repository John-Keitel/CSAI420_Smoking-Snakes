# Epic 3 — Real-Time Data Transmission & Analysis

| Field        | Value                                                                           |
| ------------ | ------------------------------------------------------------------------------- |
| Jira         | [SCRUM-17](https://csai420.atlassian.net/browse/SCRUM-17)                       |
| Product step | PRFAQ 1.4 Step 4 — Data Transmission & Analysis                                 |
| Slice        | `.specs/features/realtime-data-path/`                                           |
| Related PRD  | [`2026-07-stedi-voice-ivr.md`](prd/2026-07-stedi-voice-ivr.md) (PRD-SV-012…017) |
| Related TDD  | [`2026-07-stedi-voice-ivr.md`](../engineering/tdd/2026-07-stedi-voice-ivr.md)   |
| Assignment   | 1.7 Pass-Through API and Integration Tests (step-save + score gate)             |
| Status       | Planning                                                                        |
| Last updated | 2026-07-11                                                                      |

## Mapping

PRFAQ Step 4 says collected step data is transmitted to the cloud API for real-time
analysis, then Step 5 retrieves and announces the balance index score. Epic 3 owns
that **IoT → cloud API → score** path in this repository.

```text
IoT device ──► STEDI cloud API
                    ▲
cs420-api pass-through (this epic) ── proxy ──┘
                    ▲
Future IVR webhooks (Epics 1–2 / later slices)
```

STEDI hosts:

- Development: [https://dev.stedi.me/](https://dev.stedi.me/)
- Production: [https://stedi.me/](https://stedi.me/)
- OpenAPI: [https://dev.stedi.me/openapi-ui/](https://dev.stedi.me/openapi-ui/)

## STEDI endpoints in this epic

| Endpoint                  | Method | Role                                                             |
| ------------------------- | ------ | ---------------------------------------------------------------- |
| `/rapidsteptest`          | POST   | Save completed rapid step test (Assignment 1.7 + IVR score path) |
| `/sensorUpdates`          | POST   | Send sensor updates (OpenAPI; IVR-oriented ingestion)            |
| `/devices/updates/recent` | GET    | Observe recent device updates (IVR readiness / poll)             |
| `/riskscore/{email}`      | GET    | Retrieve balance index / risk score (STEDI computes)             |

Auth for authenticated calls: header `suresteps.session.token` from direct STEDI login for machine/raw-token flows, or server-side session-linked token resolution for browser-backed app flows.

## V1 architecture decision

**No dedicated Kafka / SNS / SQS / EventBridge queue in this epic.**

PRFAQ “next steps” mention an event-driven pipeline; the IVR TDD defers dedicated
queueing to V2 and uses STEDI’s existing ingestion plus polling of
`/devices/updates/recent`. This epic follows the TDD: pass-through to STEDI, no
local scoring algorithm, no new message bus.

## Out of scope (owned elsewhere)

| Concern                                          | Owner                                  |
| ------------------------------------------------ | -------------------------------------- |
| Twilio IVR call flow / webhooks                  | Epics 1–2 / IVR slices                 |
| Clinician consent portal                         | Epic 5 / Sprint 1 PRFAQ clinician half |
| Assignment Step 2 double-write / Step 3 cut-over | Separate migration slices              |
| Local mobility-score computation                 | STEDI cloud (not this repo)            |

## Child tasks (SCRUM-17)

| Task | Jira     | Points | Intent                                                               |
| ---- | -------- | ------ | -------------------------------------------------------------------- |
| T1   | SCRUM-18 | 1      | Adopt STEDI sensor contracts (no new queue in V1)                    |
| T2   | SCRUM-19 | 2      | Pass-through IoT step ingestion (`/rapidsteptest`, `/sensorUpdates`) |
| T3   | SCRUM-20 | 2      | Observe real-time device updates (`/devices/updates/recent`)         |
| T4   | SCRUM-21 | 1      | Pass-through mobility/risk score (`/riskscore/{email}`)              |
| T5   | SCRUM-22 | 2      | Validate data path with integration tests                            |

## Success for the epic

- Callers can save step/sensor data and retrieve a STEDI risk score through this API.
- IVR can later poll recent device updates without a local stream.
- Assignment 1.7 integration gate (user → direct STEDI login → customer → rapidsteptest → riskscore)
  passes against a deployed `API_URL`.
- Jira SCRUM-17…22 match this document (no Kafka V1 wording).
