# Human-in-the-Loop Moderation Tasks

**Design**: `.specs/features/hitl-moderation/design.md`
**Epic**: [SCRUM-82](https://csai420.atlassian.net/browse/SCRUM-82)
**Publish policy**: Local branches + commits only; do not push or open PRs until asked.

## Gate Check Commands

| Gate | Command |
| --- | --- |
| Unit / route tests | `npm test -- __test__/unit/moderation __test__/integration/coach-api-route.test.ts __test__/integration/moderation` |
| Lint | `npm run lint` |

## Task Breakdown

### T1 / SCRUM-73 — Flagged list

**Branch**: `feature/scrum-73-moderation-flagged-list`

- Add Prisma enums + `FlaggedSession` + migration + regenerate client
- `upsertFlaggedSessionOnEscalate` + hook in coach chat POST
- `GET /api/moderation/flagged` with moderator auth
- Tests: upsert on escalate; GET sorted; 401/403

### T2 / SCRUM-74 — Review

**Branch**: `feature/scrum-74-moderation-review` (from T1 tip)

- `POST /api/moderation/review`
- Tests: success → IN_REVIEW; 404; 409 resolved

### T3 / SCRUM-75 — Resolve

**Branch**: `feature/scrum-75-moderation-resolve` (from T2 tip)

- `PATCH /api/moderation/resolve/[sessionId]`
- Tests: resolve from PENDING/IN_REVIEW; drops from list; 404/409

### T4 / SCRUM-76 — Alerts

**Branch**: `feature/scrum-76-moderation-alerts` (from T3 tip)

- `notifyModeratorsHighRisk` on first HIGH upsert
- Tests: mocked `sendPushNotifications`; `alertedAt` set; no spam on re-escalate

### T5 / SCRUM-77 — Full-cycle

**Branch**: `feature/scrum-77-moderation-e2e` (from T4 tip)

- Integration test: escalate → flagged → review → resolve + alert once
