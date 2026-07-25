# Human-in-the-Loop Moderation Design

**Slice**: `.specs/features/hitl-moderation/`
**Spec**: `spec.md`
**Status**: Confirmed — locked in EPIC 10 implementation plan

## Decision summary

| Concern | Choice |
| --- | --- |
| Persistence | `FlaggedSession` + `ModerationSeverity` / `ModerationStatus` enums |
| Escalation hook | After `saveAiResponse` in `POST /api/coach/chat` when `escalate === true` |
| Auth | `getSession()` Bearer JWT; allow `developer` \| `provider` |
| Alerts | `notifyModeratorsHighRisk` → `sendPushNotifications` |
| Branching | One local branch per SCRUM; no push until asked |

## Data model

```prisma
enum ModerationSeverity { LOW MEDIUM HIGH }
enum ModerationStatus { PENDING IN_REVIEW RESOLVED }

model FlaggedSession {
  id                String             @id @default(uuid()) @db.Uuid
  sessionId         String             @unique @map("session_id") @db.Uuid
  customerEmail     String             @map("customer_email") @db.VarChar(128)
  severity          ModerationSeverity @default(HIGH)
  status            ModerationStatus   @default(PENDING)
  aiRecommendation  String?            @map("ai_recommendation") @db.Text
  humanOverride     String?            @map("human_override") @db.Text
  reviewerNotes     String?            @map("reviewer_notes") @db.Text
  reviewedByUserId  String?            @map("reviewed_by_user_id") @db.VarChar(32)
  resolvedByUserId  String?            @map("resolved_by_user_id") @db.VarChar(32)
  flaggedAt         DateTime           @default(now()) @map("flagged_at")
  reviewedAt        DateTime?          @map("reviewed_at")
  resolvedAt        DateTime?          @map("resolved_at")
  alertedAt         DateTime?          @map("alerted_at")
  session           ChatSession        @relation(...)
  @@index([status, severity, flaggedAt])
  @@map("flagged_sessions")
}
```

`ChatSession` gains optional `flaggedSession FlaggedSession?`.

## Components

```text
POST /api/coach/chat
   │ escalate=true
   ▼
upsertFlaggedSessionOnEscalate  →  FlaggedSession
   │ (SCRUM-76) severity HIGH && alertedAt null
   ▼
notifyModeratorsHighRisk  →  sendPushNotifications

GET  /api/moderation/flagged
POST /api/moderation/review
PATCH /api/moderation/resolve/[sessionId]
   │ getSession + requireModerator
   ▼
FlaggedSession repository helpers
```

| Path | Role |
| --- | --- |
| `src/lib/moderation/repository.ts` | Upsert, list, review, resolve |
| `src/lib/moderation/auth.ts` | `requireModerator()` gate |
| `src/lib/moderation/alerts.ts` | High-risk Expo notify |
| `src/lib/schemas.ts` | Review / resolve Zod bodies |
| `src/app/api/moderation/*/route.ts` | HTTP handlers |

## Status transitions

```text
(none) --escalate--> PENDING --review--> IN_REVIEW --resolve--> RESOLVED
                         \______________________resolve______/
```

Re-escalate on an open row: keep status; refresh `flaggedAt` / severity if needed.
Re-escalate on `RESOLVED`: create a new open cycle via upsert that resets to `PENDING`
(or leave resolved and create only when missing — **chosen**: upsert resets
`RESOLVED` → `PENDING` so a new escalation reopens the case).

## Error / logging

- Routes: try/catch, `HttpException` → status JSON, else 500 + logger
- Alert failures: log only; never throw into coach chat
- Loggers: `api:moderation:flagged`, `api:moderation:review`, `api:moderation:resolve`,
  `lib:moderation:alerts`
