# Human-in-the-Loop Moderation Specification

**Epic**: [SCRUM-82](https://csai420.atlassian.net/browse/SCRUM-82) — EPIC 10 — HITL Moderation
**Slice**: `.specs/features/hitl-moderation/`
**Tasks**: SCRUM-73 … SCRUM-77
**Depends on**: Coach chat persistence (`ChatSession` / `ChatMessage`) and `metadata.escalate` on AI responses (EPIC 8 + partial EPIC 9 on `main`)

## Problem Statement

Sprint 2 requires a human-in-the-loop path when the Mobility Coach escalates a
session. Escalation is already persisted as `ChatMessage.metadata.escalate`, but
there is no durable moderation queue, no review/resolve APIs for providers, and
no high-risk alert to moderators.

## Goals

- [ ] Persist escalated coach sessions as queryable `FlaggedSession` rows
- [ ] List open flagged sessions for moderators, sorted by severity then recency
- [ ] Allow providers/developers to record a human override (review)
- [ ] Allow providers/developers to resolve a flagged session
- [ ] Send Expo push alerts to moderator devices on first HIGH-severity flag
- [ ] Prove the full flag → review → resolve (+ alert once) cycle with tests

## Out of Scope

| Feature | Reason |
| --- | --- |
| Moderator dashboard UI | PRFAQ next step; not in SCRUM-73–77 |
| New `UserType.moderator` | Use existing `provider` / `developer` |
| EPIC 7 mobile consent | Separate epic |
| Changing LangChain prompts | Escalate signal already exists |
| Patient-facing moderation APIs | Moderators only via Bearer JWT |

## Assumptions & Decisions

| Assumption / decision | Chosen default | Confirmed? |
| --- | --- | --- |
| Queue model | Prisma `FlaggedSession` (not JSON-only) | y |
| Flag creation | Upsert on coach AI save when `escalate: true` | y |
| Severity MVP | Always `HIGH` when escalate is true | y |
| Status flow | `PENDING` → `IN_REVIEW` → `RESOLVED` (resolve also from `PENDING`) | y |
| Auth | `getSession()` Bearer; `developer` \| `provider` only | y |
| Alerts | Reuse `sendPushNotifications`; target active tokens for provider/developer users | y |
| Publish | Local branches/commits only until user asks to push/PR | y |

## User Stories

### P1: Flag and list escalated sessions (SCRUM-73) ⭐ MVP

**Acceptance Criteria**:

1. WHEN an AI coach response is saved with `escalate: true` THEN the system SHALL
   upsert a `FlaggedSession` for that `sessionId` with `severity=HIGH` and
   `status=PENDING` (or keep existing open status on re-escalate).
2. WHEN `escalate` is false THEN the system SHALL NOT create a flagged row.
3. WHEN a `developer` or `provider` calls `GET /api/moderation/flagged` THEN the
   response SHALL list open cases (`PENDING` or `IN_REVIEW`) sorted by severity
   descending then `flaggedAt` descending.
4. WHEN an unauthenticated caller or a `standard` user hits moderation routes THEN
   the API SHALL return 401 or 403 respectively.

### P1: Review with human override (SCRUM-74)

**Acceptance Criteria**:

1. WHEN a moderator `POST /api/moderation/review` with `{ sessionId, humanOverride, reviewerNotes? }`
   THEN the flagged row SHALL set override, notes, `reviewedByUserId`, `reviewedAt`,
   and `status=IN_REVIEW`.
2. WHEN no flagged row exists THEN the API SHALL return 404.
3. WHEN the row is already `RESOLVED` THEN the API SHALL return 409.

### P1: Resolve flagged session (SCRUM-75)

**Acceptance Criteria**:

1. WHEN a moderator `PATCH /api/moderation/resolve/[sessionId]` THEN the row SHALL
   become `RESOLVED` with `resolvedAt` and `resolvedByUserId`.
2. WHEN resolved THEN the session SHALL NOT appear in `GET /api/moderation/flagged`.
3. WHEN already `RESOLVED` THEN the API SHALL return 409.
4. WHEN no flagged row exists THEN the API SHALL return 404.

### P1: High-risk moderator alerts (SCRUM-76)

**Acceptance Criteria**:

1. WHEN a flagged session is upserted at `severity=HIGH` and `alertedAt` is null
   THEN the system SHALL send Expo pushes to active tokens of `provider` and
   `developer` users with `data.type: 'moderation-high-risk'` and `sessionId`.
2. WHEN the alert succeeds (or is attempted) THEN `alertedAt` SHALL be set so
   re-escalate does not spam.
3. WHEN send fails THEN the failure SHALL be logged and SHALL NOT fail the coach chat response.

### P1: Full-cycle verification (SCRUM-77)

**Acceptance Criteria**:

1. WHEN the integration suite runs THEN it SHALL prove escalate → listed → review →
   resolve and that the high-risk alert helper is invoked once for the first HIGH flag.
