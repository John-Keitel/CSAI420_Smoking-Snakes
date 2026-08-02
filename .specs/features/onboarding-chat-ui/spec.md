# Onboarding Chat UI (EPIC 12) Specification

**Slice**: `.specs/features/onboarding-chat-ui/`
**Status**: Draft
**Epic**: [SCRUM-140](https://csai420.atlassian.net/browse/SCRUM-140) — EPIC 12: React Native In-App Chat UI & Accessibility
**Depends on**: `chat-assisted-registration` slice (delivered — `POST /chat/continue-session`, `POST /user/chat-assisted`; reuse only, must not be modified), [ADR-001](../../../docs/engineering/adr/001-mobile-client-colocated-in-api-repo.md), [TDD 2026-08-onboarding-chat-mobile-client](../../../docs/engineering/tdd/2026-08-onboarding-chat-mobile-client.md)

## Problem Statement

EPIC 12 specifies a React Native chat UI so that users who cannot complete the standard signup form
can register conversationally. The backend for this already exists and is delivered — the
`chat-assisted-registration` slice shipped a database-backed step machine at
`POST /chat/continue-session` and account creation at `POST /user/chat-assisted`, both passing the
Week 5 suite against production. What does not exist is any client: this repository is a Next.js API
with no mobile application, and the Expo projects elsewhere in the workspace are unrelated course
challenges. The user-visible behavior EPIC 12 promises is therefore 0% delivered despite all of its
dependencies being complete.

This slice builds that client — an Expo app at `mobile/` — and wires it to the endpoints as they
exist today, without modifying backend source.

## Goals

- [ ] A user stuck on the signup form can tap **Need Help?** and reach a chat surface
- [ ] The chat collects name, email, phone, date of birth, and password across six turns
- [ ] Completing the chat creates a real account via `POST /user/chat-assisted`
- [ ] The surface is usable with a screen reader and at maximum OS font size
- [ ] The API's existing CI gates remain green with `mobile/` present in the repository

## Out of Scope

| Feature | Reason |
| --- | --- |
| Any change to backend source, routes, or schema | Delivered and covered by the Week 5 suite; reuse only |
| Speech-to-text / audio playback | SCRUM-95 — separate task, not in the 90–94 scope |
| Typing-status animation | SCRUM-96 — V1 ships a plain disabled/pending state |
| Session restore after app minimization | SCRUM-97 — must address credential handling before it can persist the accumulator |
| Post-chat feedback modal | SCRUM-98 — separate task |
| A standalone "write Jest tests" task | SCRUM-99 — tests ship inside the task that changes behavior, per `.specs/codebase/CONVENTIONS.md`; recommend closing as superseded |
| Expo Web support | API serves no CORS headers and has no `OPTIONS` handler; native only |
| EAS build / store distribution | Not required to demonstrate the behavior |
| Server-side redaction of credentials in the transcript | Backend defect; requires a follow-up slice (see Assumptions) |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Where the client lives | Expo app at `mobile/` in this repo | Keeps `.specs/`, Jira, branches and the PR gate on one remote; `sdd-execute-jira` forks worktrees from this repo — see ADR-001 | y |
| Which backend | Real `/chat/continue-session` + `/user/chat-assisted` | Production path from the delivered slice; collects every field including phone and password | y |
| Expo baseline | SDK 54 / RN 0.81 / React 19 | Matches `cs420-rn1-code-challenge-asf0`, the newer reference project | y |
| Test library | `@testing-library/react-native` 13 + `jest-expo` | RNTL 13 supports React 19; rn2 already uses it; `react-test-renderer` makes list/keyboard assertions impractical | y |
| API base URL | `Constants.expoConfig.extra.apiBaseUrl` via `expo-constants` | Extends rn2's existing `expo-constants` usage rather than hardcoding literals as rn1/rn2 do | y |
| Who validates input | The client, per step, mirroring `ChatAssistedRegistrationSchema` | The server's `advanceChat()` is a pure step counter — it never parses or validates, so errors would otherwise surface only as a bulk 400 after all six answers | y |
| Which field a message fills | Determined by the step the session is in *when sent* | `advanceChat()` returns the prompt for the current step and advances; the client tracks `nextStep` from each response | y |
| One-word name handling | Apply the `'User'` fallback for the missing part | `firstName`/`lastName` are both required `min(1)` after trim; matches `splitName()` precedent in `src/app/api/user/register-chat/route.ts` | y |
| Credential turn in the transcript | Rendered masked; excluded from the `conversationLog` sent to `/user/chat-assisted` | Reduces the visible and re-transmitted surface. Residual: the plaintext still reaches `/chat/continue-session` and is persisted server-side — a backend defect this slice cannot fix | y |
| `lastActivity` value | Timestamp of the last successful `continue-session` response | Sending "now" would make the 30-minute timeout unreachable; sending the real value lets a stale session correctly yield 408 | y |
| Reopening a dismissed sheet | Starts a fresh session | V1 has no persistence; restore is SCRUM-97 | y |

**Open questions:** two, both logged in the TDD and neither blocking this slice — (1) when to schedule
the follow-up slice that redacts credentials in the persisted transcript, (2) whether SCRUM-99 is
closed as superseded once this slice lands.

---

## User Stories

### P1: Foundation — a mobile app that talks to the API ⭐ MVP

**User Story**: As the developer, I want an Expo app with a tested transport layer, so that the chat
components have somewhere to live and a single place that knows the API contract.

**Why P1**: Nothing else in this slice can exist without it. It is the only task without a
pre-existing Jira issue.

**Acceptance Criteria**:

1. WHEN `cd mobile && npx jest` runs THEN the mobile test suite SHALL execute and pass (FND-01).
2. WHEN the root pipeline `npm run format && npm run lint && npm run typecheck && npm run test:unit && npm run build` runs with `mobile/` present THEN every command SHALL pass, proving the API toolchain is unaffected (FND-02).
3. WHEN `continueSession({chatSessionId, message, context})` is called THEN the client SHALL issue `POST {base}/chat/continue-session` with `Content-Type: application/json` and that body, and SHALL return the parsed `{response, conversationContext, nextStep, sessionActive}` (FND-03).
4. WHEN `registerChatAssisted(payload)` is called THEN the client SHALL issue `POST {base}/user/chat-assisted` and SHALL surface the HTTP status distinctly for **201**, **400**, **408**, **409**, and **500** rather than collapsing them into a generic failure (FND-04).
5. WHEN `extra.apiBaseUrl` is absent from Expo config THEN the transport SHALL fail with an explicit configuration error rather than requesting an `undefined` URL (FND-05).
6. WHEN `createChatSessionId()` is called twice THEN it SHALL return two distinct strings, each non-empty and at most 128 characters (FND-06).

### P1: Request help from the signup screen ⭐ MVP — SCRUM-90

**User Story**: As a user stuck on the signup form, I want a visible way to ask for help, so that I
am not forced to abandon registration.

**Acceptance Criteria**:

1. WHEN the signup screen renders THEN a **Need Help?** control SHALL be visible and reachable without scrolling past the form (HELP-01).
2. WHEN the signup screen first renders THEN the chat surface SHALL NOT be presented (HELP-02).
3. WHEN the user activates **Need Help?** THEN the chat surface SHALL be presented (HELP-03).
4. WHEN the user activates **Need Help?** THEN a fresh `chatSessionId` SHALL be minted for that session, distinct from any previous one and at most 128 characters (HELP-04).
5. WHEN the control is rendered THEN its touch target SHALL be at least 44×44 points (HELP-05).

### P1: A conversational surface that owns the session ⭐ MVP — SCRUM-91

**User Story**: As a user, I want the chat to appear over the signup screen and remember where we
are, so that I can get help without losing my place.

**Acceptance Criteria**:

1. WHEN the chat surface opens THEN it SHALL present as a modal or bottom sheet over the signup screen without navigating away from it (SHEET-01).
2. WHEN the chat surface opens THEN it SHALL send an opening turn and render the first assistant prompt, `"I'd be happy to help! What's your name?"` (SHEET-02).
3. WHEN the user activates the close control, taps the backdrop, or presses the Android back button THEN the chat surface SHALL dismiss (SHEET-03).
4. WHEN a turn completes THEN the surface SHALL adopt the `nextStep` from that response as the current step (SHEET-04).
5. WHEN a request fails with a network error or **500** THEN the surface SHALL surface the failure to the user and SHALL return to an idle, retryable state rather than remaining stuck pending (SHEET-05).
6. WHEN `POST /chat/continue-session` returns **400** THEN the surface SHALL display the returned `errors[]` content rather than a generic message (SHEET-06).
7. WHEN a dismissed surface is reopened THEN a new session SHALL begin with an empty transcript (SHEET-07).

### P1: Read the conversation ⭐ MVP — SCRUM-92

**User Story**: As a user, I want to see the conversation so far, so that I know what was asked and
what I answered.

**Acceptance Criteria**:

1. WHEN the transcript contains entries THEN they SHALL render in order, with user and assistant turns visually distinguishable from each other (MSG-01).
2. WHEN a new entry is appended THEN the list SHALL scroll so that the newest entry is visible without user action (MSG-02).
3. WHEN the user's turn at `password_collection` is rendered THEN it SHALL display a masked placeholder and SHALL NOT render the typed characters (MSG-03).
4. WHEN successive turns complete THEN the transcript SHALL accumulate both the user and assistant entries for each turn (MSG-04).
5. WHEN an entry is longer than the available width THEN it SHALL wrap within the bubble, and the surface SHALL NOT scroll horizontally (MSG-05).

### P1: Answer each question ⭐ MVP — SCRUM-93

**User Story**: As a user, I want to type answers comfortably and be told immediately when something
is wrong, so that I am not rejected after answering every question.

**Why P1**: The server validates nothing, so without this the first sign of a bad email is a bulk
`400` at the very end.

**Acceptance Criteria**:

1. WHEN the user enters text and activates submit THEN that text SHALL be sent as the turn and the field SHALL clear (INPUT-01).
2. WHEN the field is empty or whitespace-only THEN submit SHALL NOT issue a request (INPUT-02).
3. WHEN the on-screen keyboard is presented THEN the input field and submit control SHALL remain visible (INPUT-03).
4. WHEN the current step is `email_collection` THEN the field SHALL use an email keyboard with autocapitalization disabled; WHEN `phone_collection` a phone keypad; WHEN `birth_date_collection` a numeric keypad; WHEN `password_collection` secure text entry (INPUT-04).
5. WHEN a request is in flight THEN the submit control SHALL be disabled so a second turn cannot be sent (INPUT-05).
6. WHEN the step is `email_collection` and the value is not a valid email THEN an inline error SHALL show and the step SHALL NOT advance (INPUT-06).
7. WHEN the step is `password_collection` and the value is shorter than 8 characters or lacks an uppercase letter, lowercase letter, digit, or special character THEN an inline error SHALL show and the step SHALL NOT advance (INPUT-07).
8. WHEN the step is `birth_date_collection` and the value is not `YYYY-MM-DD` or is not a real calendar date THEN an inline error SHALL show and the step SHALL NOT advance (INPUT-08).
9. WHEN the step is `phone_collection` and the value does not match an optional `+` followed by 7–15 digits THEN an inline error SHALL show and the step SHALL NOT advance (INPUT-09).
10. WHEN the step is `name_provided` and the value exceeds 64 characters or contains `<`, `>`, `;`, or `--` THEN an inline error SHALL show and the step SHALL NOT advance; WHEN the value is a single word THEN the missing name part SHALL default to `"User"` so the final request is not rejected (INPUT-10).
11. WHEN the step reaches `completion` THEN the client SHALL `POST /user/chat-assisted` with the accumulated `userData`, and on **201** SHALL present a confirmation and dismiss the surface (INPUT-11).
12. WHEN `/user/chat-assisted` returns **409** THEN the client SHALL show that the email is already registered and SHALL retain the session so the user can supply a different email (INPUT-12).
13. WHEN `/user/chat-assisted` returns **408** THEN the client SHALL present an expired-session state offering a restart (INPUT-13).
14. WHEN `/user/chat-assisted` returns **400** THEN the client SHALL display the returned `errors[]` content (INPUT-14).
15. WHEN the client sends `conversationLog` to `/user/chat-assisted` THEN the credential turn SHALL be excluded from it (INPUT-15).

### P1: Usable with a screen reader and large text ⭐ MVP — SCRUM-94

**User Story**: As a user who relies on a screen reader or large system text, I want the chat to be
announced and to stay readable, so that the accessible registration path is actually accessible.

**Note**: SCRUM-94 says "aria-label"; that is a web attribute. The React Native equivalent is
`accessibilityLabel`, which is what these criteria require.

**Acceptance Criteria**:

1. WHEN any interactive element in the flow is focused by a screen reader THEN it SHALL expose a non-empty `accessibilityLabel` and an appropriate `accessibilityRole` (A11Y-01).
2. WHEN a transcript entry is focused by a screen reader THEN its announcement SHALL identify the speaker, distinguishing assistant turns from the user's own (A11Y-02).
3. WHEN a new assistant reply is appended THEN it SHALL be announced to the screen reader without requiring the user to hunt for it (A11Y-03).
4. WHEN the OS font scale is increased to its maximum THEN all chat text SHALL scale, and no text SHALL be clipped, truncated, or overlapped (A11Y-04).
5. WHEN text scales THEN a bounded `maxFontSizeMultiplier` SHALL keep the layout usable rather than allowing unbounded growth (A11Y-05).
6. WHEN the chat surface is presented THEN content behind it SHALL NOT be reachable by the screen reader (A11Y-06).
7. WHEN a screen reader is active at the time of registration THEN the client SHALL send `accessibilityMode` to `/user/chat-assisted` (A11Y-07).

---

## Edge Cases

- WHEN the device has no network THEN each request SHALL fail visibly and leave the surface retryable, never silently pending (covers SHEET-05).
- WHEN the user submits the same turn twice rapidly THEN only one request SHALL be issued (covers INPUT-05).
- WHEN `advanceChat` is at `completion` and the user sends another message THEN the assistant SHALL repeat the completion prompt and the client SHALL NOT re-submit registration.
- WHEN a name contains international characters (`José María`, `García-López`) THEN it SHALL be accepted — only `<`, `>`, `;`, and `--` are rejected.
- WHEN the base URL points at `localhost` from a device or emulator THEN requests will fail; a LAN address or the deployed host is required (documented, not enforced in code).

---

## Requirement Traceability

| Requirement ID | Story | Jira | Phase | Status |
| --- | --- | --- | --- | --- |
| FND-01 | Foundation | *(new issue)* | Tasks | Mapped |
| FND-02 | Foundation | *(new issue)* | Tasks | Mapped |
| FND-03 | Foundation | *(new issue)* | Tasks | Mapped |
| FND-04 | Foundation | *(new issue)* | Tasks | Mapped |
| FND-05 | Foundation | *(new issue)* | Tasks | Mapped |
| FND-06 | Foundation | *(new issue)* | Tasks | Mapped |
| HELP-01 | Request help | SCRUM-90 | Tasks | Mapped |
| HELP-02 | Request help | SCRUM-90 | Tasks | Mapped |
| HELP-03 | Request help | SCRUM-90 | Tasks | Mapped |
| HELP-04 | Request help | SCRUM-90 | Tasks | Mapped |
| HELP-05 | Request help | SCRUM-90 | Tasks | Mapped |
| SHEET-01 | Conversational surface | SCRUM-91 | Tasks | Mapped |
| SHEET-02 | Conversational surface | SCRUM-91 | Tasks | Mapped |
| SHEET-03 | Conversational surface | SCRUM-91 | Tasks | Mapped |
| SHEET-04 | Conversational surface | SCRUM-91 | Tasks | Mapped |
| SHEET-05 | Conversational surface | SCRUM-91 | Tasks | Mapped |
| SHEET-06 | Conversational surface | SCRUM-91 | Tasks | Mapped |
| SHEET-07 | Conversational surface | SCRUM-91 | Tasks | Mapped |
| MSG-01 | Read the conversation | SCRUM-92 | Tasks | Mapped |
| MSG-02 | Read the conversation | SCRUM-92 | Tasks | Mapped |
| MSG-03 | Read the conversation | SCRUM-92 | Tasks | Mapped |
| MSG-04 | Read the conversation | SCRUM-92 | Tasks | Mapped |
| MSG-05 | Read the conversation | SCRUM-92 | Tasks | Mapped |
| INPUT-01 | Answer each question | SCRUM-93 | Tasks | Mapped |
| INPUT-02 | Answer each question | SCRUM-93 | Tasks | Mapped |
| INPUT-03 | Answer each question | SCRUM-93 | Tasks | Mapped |
| INPUT-04 | Answer each question | SCRUM-93 | Tasks | Mapped |
| INPUT-05 | Answer each question | SCRUM-93 | Tasks | Mapped |
| INPUT-06 | Answer each question | SCRUM-93 | Tasks | Mapped |
| INPUT-07 | Answer each question | SCRUM-93 | Tasks | Mapped |
| INPUT-08 | Answer each question | SCRUM-93 | Tasks | Mapped |
| INPUT-09 | Answer each question | SCRUM-93 | Tasks | Mapped |
| INPUT-10 | Answer each question | SCRUM-93 | Tasks | Mapped |
| INPUT-11 | Answer each question | SCRUM-93 | Tasks | Mapped |
| INPUT-12 | Answer each question | SCRUM-93 | Tasks | Mapped |
| INPUT-13 | Answer each question | SCRUM-93 | Tasks | Mapped |
| INPUT-14 | Answer each question | SCRUM-93 | Tasks | Mapped |
| INPUT-15 | Answer each question | SCRUM-93 | Tasks | Mapped |
| A11Y-01 | Accessible flow | SCRUM-94 | Tasks | Mapped |
| A11Y-02 | Accessible flow | SCRUM-94 | Tasks | Mapped |
| A11Y-03 | Accessible flow | SCRUM-94 | Tasks | Mapped |
| A11Y-04 | Accessible flow | SCRUM-94 | Tasks | Mapped |
| A11Y-05 | Accessible flow | SCRUM-94 | Tasks | Mapped |
| A11Y-06 | Accessible flow | SCRUM-94 | Tasks | Mapped |
| A11Y-07 | Accessible flow | SCRUM-94 | Tasks | Mapped |

**Coverage:** 45 total, 45 mapped to tasks, 0 unmapped ✅ — FND→T1, HELP→T2, SHEET→T3, MSG→T4, INPUT→T5, A11Y→T6 (see `tasks.md`)

---

## Success Criteria

- [ ] `cd mobile && npx jest` passes
- [ ] Root gates green with `mobile/` present: `npm run format`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`
- [ ] Manual device walkthrough: **Need Help?** → six turns → account created; verified by querying the `users` table for the new record and `chat_registration_sessions` for the transcript
- [ ] Duplicate email produces a **409** in-sheet with the session retained and a successful retry
- [ ] VoiceOver and TalkBack announce each assistant reply; every control is labeled
- [ ] At maximum OS font size no chat text is clipped, truncated, or overlapped
- [ ] `chat-assisted-registration` remains untouched — Week 5 suite still passes
