# Chat-Assisted Registration (Week 5) Specification

**Slice**: `.specs/features/chat-assisted-registration/`
**Status**: Draft
**Depends on**: EPIC 14 `register-chat` (reuse only — must not be modified), escalation pipeline (`createEscalation`, `publishEscalationMessage`, `stripHtml`), Prisma `User` model

## Problem Statement

The Week 5 integration test suite (`week-5-integration-tests-asf0/__test__/week5.test.js`) verifies an AI-powered chat registration system with three public endpoints: `POST /user/chat-assisted`, `POST /escalate-registration`, and `POST /chat/continue-session`. None of these endpoints exist in this repo, so the suite fails with 404s against local and deployed code. This slice implements the endpoints exactly to the suite's contract so the official tests pass unchanged, while reusing existing infra (escalation persistence, queue publish, bcrypt, Prisma) and leaving EPIC 14 and the shared validation/error helpers untouched.

## Goals

- [ ] `POST /user/chat-assisted` creates users via chat flow and validates/sanitizes input per the Week 5 contract
- [ ] `POST /escalate-registration` persists registration escalations with issueType-driven triage and SLA
- [ ] `POST /chat/continue-session` maintains conversation context across requests (rule-based MVP)
- [ ] `DELETE /user/[userId]` allows test-data cleanup for repeat runs
- [ ] Official suite passes: `API_URL=http://localhost:3000 npm run test:week5` and against Vercel

## Out of Scope

| Feature | Reason |
| --- | --- |
| Real OpenAI/LangGraph responses | User decision: rule-based MVP; suite asserts response shape only |
| Jira slice/task publishing | User decision: no Jira for this slice |
| `GET /analytics/chat-registration` | Optional in suite; a 404 skips it safely — do not implement |
| Modifying EPIC 14 `register-chat` route/schema | User decision: must not break EPIC 14 |
| Modifying shared `formatZodErrors` / `SignUpSchema` / escalation classifier | Existing tests depend on them; feature-local equivalents instead |
| Auth on new endpoints | User decision: public, matching the suite (no `suresteps.session.token`) |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Phone validation | `^\+?\d{7,15}$` (optional `+`) | Suite sends `8014567890` (no `+`); strict E.164 would fail happy path; `invalid-phone` still rejected | y |
| Password policy | upper + lower + digit + special (same rules as `SignUpSchema`), error text contains word "password" | Suite asserts error message contains "password" | y |
| Error body for chat-assisted 400 | `{ errors: string[], requiresChat: true }` | Suite asserts `errors` is an Array and `requiresChat === true`; shared `formatZodErrors` returns an object — feature-local flat formatter | y |
| Escalation SLA mapping | `technical_difficulties → HIGH` ("15-30 minutes"), others → `MEDIUM` | Suite asserts exact `"15-30 minutes"` for technical difficulties | y |
| Session persistence | New Prisma model `ChatRegistrationSession` keyed by `chatSessionId` (String) | Existing `ChatSession` is UUID-keyed with FK to `User`; suite ids are `session_1234567890` and may precede user creation | y |
| Duplicate email in chat-assisted | Return 409 (repo precedent) | Unique timestamped emails + working `DELETE /user/:id` keep re-runs green | y |
| XSS/SQLi input | Reject with 400 (names may not contain `<`, `>`, `--`, `;`) | Suite accepts 201 (sanitized) OR 400; rejection is simpler and keeps DB clean | y |
| Session timeout | `lastActivity` older than 30 min → 408 `{ message: "…session…" }`; check before validation | Suite accepts 200/201/408; 408 proves timeout handling | y |
| `accessibilityMode` / `locale` / `sessionMetrics` | Accepted and ignored (persist `locale` on User when present) | Suite only asserts 201 | y |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Chat-Assisted User Registration ⭐ MVP

**User Story**: As a new user, I want to register through a chat assistant so that I can create an account conversationally.

**Why P1**: Core of the Week 5 suite; 8 of 15 tests hit this endpoint.

**Acceptance Criteria**:

1. WHEN `POST /user/chat-assisted` receives a valid `userData` (email, password, birthDate `YYYY-MM-DD`, phone, firstName, lastName) plus `chatSessionId` THEN the API SHALL return **201** with `{ user: { id, email, firstName, lastName, createdAt }, message }` where `message` contains `"chat assistant"` (CAT-01).
2. WHEN the request has an invalid email, weak password, invalid birthDate, or missing required fields THEN the API SHALL return **400** with `{ errors: string[] }` (non-empty) and `requiresChat: true` (CAT-02).
3. WHEN `userData.email` is one of `invalid-email`, `missing-at-symbol.com`, `@missing-local-part.com`, `spaces in@email.com` THEN the API SHALL return **400**; for `valid.email@example.com` SHALL return **201** (CAT-03).
4. WHEN `userData.password` is `Str0ngP@ssw0rd!` THEN the API SHALL return **201**; for `weak`, `12345678`, `NoNumbers!`, `nonumbers123` SHALL return **400** and at least one error message SHALL contain the word `"password"` (case-insensitive) (CAT-04).
5. WHEN `firstName` contains `<script>` or `lastName` contains `--` / `;` THEN the API SHALL return **400** (reject, no sanitized-store requirement) (CAT-05).
6. WHEN names contain international characters (`José María`, `García-López`) THEN the API SHALL return **201** and echo them back unmodified in `user.firstName` / `user.lastName` (CAT-06).
7. WHEN the request includes `accessibilityMode`, `locale`, and/or `sessionMetrics` THEN the API SHALL return **201** (CAT-07).
8. WHEN `lastActivity` is more than 30 minutes old THEN the API SHALL return **408** with a `message` containing `"session"` (checked before field validation) (CAT-08).
9. WHEN 5 concurrent valid requests are made THEN at least one SHALL return **201** (CAT-09).
10. WHEN the body is malformed (e.g. `{ invalidField: "x" }`) THEN the API SHALL return **400**; a subsequent valid request SHALL return **201** (CAT-10).

### P1: Registration Escalation ⭐ MVP

**User Story**: As a confused or stuck user, I want to escalate my registration problem so that a human support agent can help.

**Why P1**: Second pillar of the suite; 4 tests.

**Acceptance Criteria**:

1. WHEN `POST /escalate-registration` receives `{ phoneNumber, registrationData, chatSessionId, issueType, aiResponse, responsePreference, conversationContext }` with `issueType: "confusion_about_process"` THEN the API SHALL return **200** with `{ status: "escalated", escalationId, estimatedResponseTime, message }` where `message` contains `"support team"` and the escalation SHALL be persisted via the existing repository (ESC-01).
2. WHEN `issueType` is `"technical_difficulties"` THEN the API SHALL return **200** with `estimatedResponseTime` exactly `"15-30 minutes"` (ESC-02).
3. WHEN `issueType` is `"account_creation_failed"` THEN the API SHALL return **200** with the same escalated contract (ESC-03).
4. WHEN `phoneNumber` is not a valid phone (e.g. `invalid-phone`), `chatSessionId` is missing, or `issueType` is unknown THEN the API SHALL return **400** with `{ errors: string[] }` non-empty (ESC-04).
5. WHEN an escalation exists THEN `DELETE /escalation/[escalationId]` SHALL remove it (already implemented — reuse) (ESC-05).

### P1: Chat Session Continuation ⭐ MVP

**User Story**: As a user mid-registration, I want the chat to remember our conversation so that I can continue where I left off.

**Why P1**: 1 test, required for the suite.

**Acceptance Criteria**:

1. WHEN `POST /chat/continue-session` receives `{ chatSessionId, message, context }` THEN the API SHALL return **200** with `{ response, conversationContext, nextStep, sessionActive: true }` (SES-01).
2. WHEN the same `chatSessionId` is used for a second request THEN `conversationContext` SHALL contain more than 1 entry (grows with both user messages and assistant responses) (SES-02).
3. WHEN the session id is unknown THEN the API SHALL create a fresh session and respond **200** (SES-03).
4. Conversation state SHALL be persisted in the database, not memory, so it survives server restarts and multiple instances (SES-04).

### P1: Test-Data Cleanup

**User Story**: As a test harness, I want to delete users created during tests so that repeat runs do not collide on duplicate emails.

**Acceptance Criteria**:

1. WHEN `DELETE /user/[userId]` receives a user id created by chat-assisted registration THEN the API SHALL delete the user and return **204** (CLEAN-01).
2. WHEN the user id does not exist THEN the API SHALL return **404** (CLEAN-02).

---

## Edge Cases

- WHEN the body is empty or not JSON THEN the API SHALL return **400** (not 500) for all three endpoints.
- WHEN `userData` has only `email` (missing password/birthDate/names) THEN the API SHALL return **400** with `requiresChat: true`.
- WHEN `chatSessionId` exceeds 128 characters THEN the API SHALL return **400**.
- WHEN `lastActivity` is absent THEN timeout handling SHALL be skipped and normal validation runs.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| CAT-01 | P1: Chat-Assisted | Design | Pending |
| CAT-02 | P1: Chat-Assisted | Design | Pending |
| CAT-03 | P1: Chat-Assisted | Design | Pending |
| CAT-04 | P1: Chat-Assisted | Design | Pending |
| CAT-05 | P1: Chat-Assisted | Design | Pending |
| CAT-06 | P1: Chat-Assisted | Design | Pending |
| CAT-07 | P1: Chat-Assisted | Design | Pending |
| CAT-08 | P1: Chat-Assisted | Design | Pending |
| CAT-09 | P1: Chat-Assisted | Design | Pending |
| CAT-10 | P1: Chat-Assisted | Design | Pending |
| ESC-01 | P1: Escalation | Design | Pending |
| ESC-02 | P1: Escalation | Design | Pending |
| ESC-03 | P1: Escalation | Design | Pending |
| ESC-04 | P1: Escalation | Design | Pending |
| ESC-05 | P1: Escalation | Design | Pending |
| SES-01 | P1: Session | Design | Pending |
| SES-02 | P1: Session | Design | Pending |
| SES-03 | P1: Session | Design | Pending |
| SES-04 | P1: Session | Design | Pending |
| CLEAN-01 | P1: Cleanup | Design | Pending |
| CLEAN-02 | P1: Cleanup | Design | Pending |

**Coverage:** 21 total, 0 mapped to tasks, 21 unmapped ⚠️

---

## Success Criteria

- [ ] `API_URL=http://localhost:3000 npm run test:week5` passes 100% (15/15 tests) against local `next dev`
- [ ] `API_URL=https://<vercel-app>.vercel.app npm run test:week5` passes 100% after deploy
- [ ] In-repo gates green: `npm run lint`, `npm run typecheck`, `npm run test:unit`, in-repo integration tests
- [ ] EPIC 14 `register-chat` tests still pass (no modification to that route/schema)
