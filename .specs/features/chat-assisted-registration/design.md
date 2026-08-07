# Chat-Assisted Registration Design

**Spec**: `.specs/features/chat-assisted-registration/spec.md`
**Status**: Draft

---

## Architecture Overview

Four public App Router routes (no auth) reuse existing libraries; one new Prisma model
backs chat-session persistence. All Week 5 contracts are feature-local (new files),
so nothing in EPIC 14 or the shared libs changes.

```mermaid
graph TD
    A[week5.test.js] --> B[POST /user/chat-assisted]
    A --> C[POST /escalate-registration]
    A --> D[POST /chat/continue-session]
    A --> E[DELETE /user/:id]

    B --> B1[ChatAssistedRegistrationSchema]
    B --> B2[bcrypt + prisma.user.create]
    B --> B3[feature-local flat error formatter]

    C --> C1[RegistrationEscalationSchema]
    C --> C2[handleRegistrationEscalation: issueType → triage]
    C2 --> C3[createEscalation + publishEscalationMessage + stripHtml]

    D --> D1[ContinueSessionSchema]
    D --> D2[rule-based state machine]
    D2 --> D3[ChatRegistrationSession (new model)]
```

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --- | --- | --- |
| `createEscalation` | `src/lib/escalation/repository.ts` | Import directly for registration escalations (mints `esc_…` id, persists row) |
| `publishEscalationMessage` | `src/lib/escalation/queue.ts` | Import directly; publish after persist (same pattern as `handler.ts`) |
| `stripHtml` | `src/lib/validation/index.ts` | Sanitize conversation text before storing in escalation/session context |
| `HttpException` | `src/lib/http.ts` | Error responses (`409` duplicate email, `500`) |
| `getAppLogger` | `src/lib/logger` | Per-route logger `getAppLogger('api:user:chat-assisted')` |
| bcrypt + `prisma.user.create` pattern | `src/app/api/user/register-chat/route.ts` | Same hashing + create shape (`firstName`, `lastName`, `dateOfBirth`, `phone`, `email`, `password`) — reimplemented in the new route, **not** shared/modified |
| Password policy rules | `SignUpSchema` in `src/lib/schemas.ts` | Same four regexes (upper/lower/digit/special) copied into the feature schema (message must contain "password") |
| Escalation SLA map | `src/lib/escalation/handler.ts:18` | `HIGH → '15-30 minutes'`, `MEDIUM → '30-60 minutes'`, `LOW → '1-2 hours'` — replicate in `handleRegistrationEscalation` |
| `User` model | `prisma/schema.prisma:22` | `firstName`, `lastName`, `dateOfBirth` (required), `dob`, `phone`, `locale` all present — no user-model change |

### Integration Points

| System | Integration Method |
| --- | --- |
| PostgreSQL (Prisma) | New `ChatRegistrationSession` model + migration (see Data Models) |
| Escalation queue | `publishEscalationMessage` — already transport-abstracted, no infra change |
| Deployed API | Routes under `src/app/…` map to `/user/chat-assisted`, `/escalate-registration`, `/chat/continue-session`, `/user/[userId]` (public by decision) |

---

## Components

### `POST /user/chat-assisted` route

- **Purpose**: Create a user via the chat flow with Week 5 validation contract.
- **Location**: `src/app/user/chat-assisted/route.ts`
- **Behavior**:
    1. Parse JSON (empty/malformed → 400 flat errors).
    2. **Timeout check first**: if `lastActivity` present and older than 30 min (`CHAT_SESSION_TIMEOUT` default `1800000`) → 408 `{ message: 'Chat session has expired' }`.
    3. `ChatAssistedRegistrationSchema.safeParse` → 400 `{ errors: string[], requiresChat: true }` on failure.
    4. Duplicate email → 409 (repo precedent).
    5. `bcrypt.hash(password, 10)`, `prisma.user.create` with `name = \`${firstName} ${lastName}\``, `firstName`, `lastName`, `dateOfBirth` (from `birthDate`), `dob`, `phone`, `locale` (when sent).
    6. 201 `{ user: { id, email, firstName, lastName, createdAt }, message: 'Account created successfully via chat assistant!' }`.
- **Interfaces**: `POST(request: NextRequest): Promise<NextResponse>`
- **Dependencies**: `prisma` (`@/lib/db`), bcrypt, `HttpException`, logger
- **Reuses**: pattern from `register-chat` (no code sharing — EPIC 14 untouched)

### `POST /escalate-registration` route + `handleRegistrationEscalation`

- **Purpose**: Persist a registration escalation with issueType-driven triage.
- **Location**: `src/app/escalate-registration/route.ts` (route), `src/lib/registration-escalation.ts` (handler)
- **Behavior**:
    1. Parse JSON; `RegistrationEscalationSchema.safeParse` → 400 `{ errors: string[] }`.
    2. `handleRegistrationEscalation(input)`:
       - `originalQuestion` = last `user` message in `conversationContext`, else JSON summary of `registrationData`, else `"Registration assistance requested"`.
       - `aiResponse` = input `aiResponse` ?? `"Registration could not be completed by the assistant."`
       - **Triage by issueType** (bypasses the shared classifier — do not modify it):
         | issueType | priority | category |
         | --- | --- | --- |
         | `technical_difficulties` | HIGH | TECHNICAL |
         | `confusion_about_process` | MEDIUM | GENERAL |
         | `account_creation_failed` | MEDIUM | GENERAL |
       - `createEscalation({ phoneNumber, sessionId: chatSessionId, userId, originalQuestion, aiResponse, responsePreference, priority, category, waitingForResponse: true })` (userId/sessionId optional — model has `String?` opaque columns).
       - `publishEscalationMessage(...)` after persist; queue failure logged, never fails the request.
       - Return `{ escalation, estimatedResponseTime }` from the replicated SLA map.
    3. 200 `{ status: 'escalated', escalationId, estimatedResponseTime, message: 'Your registration issue has been forwarded to our support team' }`.
- **Reuses**: `createEscalation`, `publishEscalationMessage`, `stripHtml`, `HttpException`, logger

### `POST /chat/continue-session` route + session repository

- **Purpose**: Rule-based conversational continuation with persisted context.
- **Location**: `src/app/chat/continue-session/route.ts`, `src/lib/chat-session-repository.ts`
- **Behavior**:
    1. `ContinueSessionSchema.safeParse` (`chatSessionId` 1..128, `message` 1..5000, `context` optional enum `initial_greeting` | `name_provided` | …).
    2. `getOrCreateChatSession(chatSessionId)` → row or new row.
    3. Append `{ role: 'user', message }`; advance state machine:
       `initial_greeting → name_provided → email_collection → …` (canned assistant prompts, e.g. `"I'd be happy to help! What's your name?"`).
    4. Append `{ role: 'assistant', message }`, persist JSON `conversationContext` + `currentStep` + `lastActivity`.
    5. 200 `{ response, conversationContext, nextStep, sessionActive: true }`.
- **Interfaces**:
    - `getOrCreateChatSession(chatSessionId: string): Promise<ChatRegistrationSession>`
    - `updateChatSession(chatSessionId: string, data: { conversationContext: JsonValue; currentStep: string }): Promise<void>`
- **Dependencies**: `prisma` (`@/lib/db`)
- **Reuses**: `stripHtml` on user message before storing

### `DELETE /user/[userId]` route

- **Purpose**: Public cleanup for the Week 5 suite (`DELETE /user/:id`).
- **Location**: `src/app/user/[userId]/route.ts`
- **Behavior**: `prisma.user.delete({ where: { id } })` → 204 (body: null); `EntityNotFoundException` (or null check) → 404 `{ error: 'User not found' }`. (Route `src/app/user/route.ts` POST exists already; adding `[userId]` subroute is safe in App Router.)
- **Reuses**: `EntityNotFoundException` from `@/lib/db`

### Feature-local schemas (`src/lib/schemas/`)

- `chat-assisted-registration.schema.ts` — nested `userData` (`email` via `z.email()`, `password` 8..128 + upper/lower/digit/special with "password" in each message, `birthDate` `YYYY-MM-DD` regex → Date, `phone` `^\+?\d{7,15}$`, `firstName`/`lastName` 1..64 with forbidden `[<>;]` and `--`), `chatSessionId` 1..128, optional `conversationLog`, `accessibilityMode`, `locale`, `sessionMetrics`, `lastActivity` (coerce date).
- `registration-escalation.schema.ts` — `phoneNumber` `^\+?\d{7,15}$`, `registrationData` optional object, `chatSessionId` required 1..128, `issueType` enum (`confusion_about_process` | `technical_difficulties` | `account_creation_failed` | `validation_error`), `aiResponse` optional, `responsePreference` enum (`call` | `text` | `chat`), `conversationContext` optional array `{ role, message }`.
- `continue-session.schema.ts` — as above.

### Flat error formatter

- **Purpose**: Produce `{ errors: string[] }` from a Zod error (Week 5 contract) without touching shared `formatZodErrors`.
- **Location**: `src/lib/validation/week5-errors.ts` (new)
- **Interface**: `flattenZodErrors(error: ZodError): { errors: string[] }` — maps each issue to `field: message` (or message only) so messages like `"password: must contain at least one uppercase letter"` contain the word `password` (satisfies CAT-04's substring check).

---

## Data Models

### `ChatRegistrationSession` (new — Prisma)

```prisma
model ChatRegistrationSession {
    id                 String   @id @default(uuid()) @db.Uuid
    chatSessionId      String   @unique @map("chat_session_id") @db.VarChar(128)
    conversationContext Json    @map("conversation_context") // [{ role, message }]
    currentStep        String   @map("current_step") @db.VarChar(64)
    lastActivity       DateTime @default(now()) @map("last_activity")
    createdAt          DateTime @default(now()) @map("created_at")
    updatedAt          DateTime @updatedAt @map("updated_at")

    @@map("chat_registration_sessions")
}
```

**Relationships**: none (anonymous chat sessions; `chatSessionId` is the business key).
**Migration**: `prisma migrate dev --name add_chat_registration_sessions` (local Postgres via `docker-compose.yml`); production applies via `npm run db:sync`. If no DB is available, generate SQL with `prisma migrate diff` and hand-write the migration folder.

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| --- | --- | --- |
| Empty / malformed JSON body | `request.json().catch(() => ({}))` → schema fails → 400 | 400 `{ errors: [...] }` |
| Invalid email / weak password / bad birthDate / missing fields | Schema rejection → flat errors | 400 `{ errors: string[], requiresChat: true }` (chat-assisted) / `{ errors: string[] }` (escalation) |
| Duplicate email (chat-assisted) | `HttpException(409)` | 409 `{ error: 'Email already registered' }` |
| Session timeout | Pre-validation check | 408 `{ message: 'Chat session has expired' }` |
| Queue publish failure | Logged warn, request succeeds | None (same policy as `handler.ts`) |
| Unknown `issueType` / bad phone | Schema enum/regex | 400 `{ errors: [...] }` |
| Unknown user id in DELETE | `EntityNotFoundException` | 404 `{ error: 'User not found' }` |
| Unexpected failures | `logger.error` + 500 `{ error: 'Server Error' }` | 500 |

---

## Risks & Concerns

| Concern | Location | Impact | Mitigation |
| --- | --- | --- | --- |
| Strict E.164 phone validation would fail suite happy path | `src/lib/schemas.ts:11` | `8014567890` rejected → suite fails | Feature schemas use `^\+?\d{7,15}$`; shared schemas untouched |
| Shared `formatZodErrors` shape (`errors` object) mismatches suite (array) | `src/lib/validation/index.ts:8` | Suite asserts `errors instanceof Array` | New `flattenZodErrors` in `src/lib/validation/week5-errors.ts` |
| Classifier would give technical issues MEDIUM ("30-60 minutes"), suite wants exact "15-30 minutes" | `src/lib/escalation/classifier.ts:102` | ESC-02 fails | issueType→priority map in `handleRegistrationEscalation`; classifier untouched (existing tests stay green) |
| Existing `ChatSession` is UUID-keyed with User FK | `prisma/schema.prisma:81` | Suite `session_…` ids + anonymous sessions don't fit | New `ChatRegistrationSession` model keyed by string `chatSessionId` |
| Duplicate email on re-run if cleanup fails | `User.email @unique` | 409 → suite test fails | Public `DELETE /user/[userId]` + timestamped test emails |
| `flattenZodErrors` messages may not contain word "password" | new file | CAT-04 substring assertion fails | Include field name in messages (`password: …`) and verify against the suite matrix in tests |
| Migration requires a database | `prisma/migrations/` | `migrate dev` needs Postgres | Use `docker compose up -d postgres` or `prisma migrate diff` + hand-written migration |
| 4 execution phases (>3) | — | Skill requires sub-agent offer | Execution session offers one worker per phase (user must accept); inline fallback otherwise |

---

## Tech Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Endpoint auth | Public (no `suresteps.session.token`) | User decision; suite sends no auth headers |
| Chat engine | Rule-based state machine | User decision; suite asserts response shape only |
| Chat-assisted logic sharing with EPIC 14 | Reimplement pattern, do not extract shared module | User decision: avoid breaking EPIC 14; duplication is ~15 lines |
| Escalation triage | New issueType→triage map (bypass classifier) | Exact SLA assertion; classifier + its tests untouched |
| Session persistence | New Prisma model | String keys + anonymous sessions incompatible with `ChatSession` |
| Analytics endpoint | Not implemented | Suite treats non-200 as optional skip |

> Project-level decisions: none — all choices are feature-local (new files only). No ADR/STATE change required.
