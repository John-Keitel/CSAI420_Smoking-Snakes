# Web Chat UI Enhancements Specification

**Slice**: `.specs/features/web-chat-ui-enhancements/`
**Status**: Draft
**Epic**: NEW — Web MVP Chat Enhancements (not yet in Jira; `/sdd-tasks-jira` will create the epic and publish W1–W5 as task issues under it)
**Depends on**: `feat/web-mvp` branch (commit `5a98d1c` — "feat(web): add basic web client" — the web client exists with home/signin/signup/chat pages; reuse and extend, do not rewrite), [`CONVENTIONS.md`](../../codebase/CONVENTIONS.md), existing `src/app/globals.css` hand-written design system (NOT Tailwind/shadcn — preserve it)

## Problem Statement

The web frontend on `feat/web-mvp` shipped a thin mirror of the mobile onboarding chat (`src/components/chat-assistant.tsx`, 264 lines) plus `AuthForm` and `SiteHeader`, but it has visible gaps that the React Native slice (SCRUM-90..94) never had to address for web:

- the pending state is **plain static italic text** (`"STEDI is thinking…"` in `.chat-pending`) — no typing animation (contrast RN SCRUM-96);
- a **tab refresh loses the conversation** — `ChatAssistant` holds `messages`/`currentStep`/`collected` in component state only, so F5 or a route change restarts from the greeting (contrast RN SCRUM-97 "session restore after app minimization");
- there is **no feedback collection** after completion — `.success-banner` shows a static confirmation and nothing else (contrast RN SCRUM-98);
- there is **no voice I/O** — no `SpeechSynthesis` (TTS) or `SpeechRecognition` (STT) affordance (contrast RN SCRUM-95);
- and the web frontend has **ZERO web UI test coverage** — the Playwright suite under `__test__/e2e/` only exercises API `route.ts` handlers via `request.post` (see `__test__/e2e/helpers/auth.helper.ts`), and there are no vitest component tests for `AuthForm`, `ChatAssistant`, or `SiteHeader` (the `__test__/unit/` glob only matches `*.test.ts`, not `*.tsx`, and the config uses `environment: 'node'` not jsdom).

This slice closes those gaps in the spirit of Jira tasks SCRUM-95..99 (which are React Native scoped) adapted to the web client. New Jira issues will be created later by `/sdd-tasks-jira`.

## Goals

- [ ] An animated typing indicator replaces the plain `"STEDI is thinking…"` text while a chat turn is in flight
- [ ] A tab refresh restores the in-progress conversation from `sessionStorage` (excluding the password)
- [ ] A post-chat feedback affordance appears after completion and is recorded (log-only — no backend route)
- [ ] Web Speech API TTS and STT affordances appear where supported, and are hidden where not (P2 — may defer)
- [ ] Component tests (vitest + RTL) and Playwright browser specs cover the web UI pages and components

## Out of Scope

| Feature | Reason |
| --- | --- |
| Web auth loop (token reuse, middleware, protected routes, dashboard, sign-out) | Separate slice; ownership TBD with the team |
| Post-login product views (assessments, devices, escalation web UI) | Not decided; no PRD yet |
| Any backend route/schema changes | Backend is delivered and covered by its suite; reuse only. Feedback is log-only |
| Tailwind/shadcn migration | The web client uses a hand-written `globals.css` design system; do not introduce a new styling system in this slice |
| `mobile/` changes | This slice is web-only; RN enhancements belong to a separate slice (SCRUM-90..99 are RN scoped) |
| A new dedicated backend `POST /feedback` route | Deferred to a follow-up backend slice; this slice records feedback client-side only |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Feedback collection | Log-only. Client components cannot import the server-side Winston logger directly (`src/lib/logger` is server-only); use a client-safe approach — `console.info` gated by `process.env.NODE_ENV === 'development'` — and note a follow-up backend slice could add `POST /feedback` | Preserves the read-only-backend constraint; the web client has no server action for feedback today | n |
| Session restore storage | `sessionStorage` (cleared on tab close) | Matches "tab refresh restores, new tab starts fresh". `localStorage` would persist across tabs — wrong scope for a transient onboarding conversation | y |
| Password exclusion | NEVER persist the password field to `sessionStorage`. If the restored step is `password_collection`, re-prompt for the password | Credentials must not be at rest in tab-scoped storage; matches the RN slice's MSG-03/INPUT-15 spirit | y |
| Web Speech API | TTS via `window.speechSynthesis`; STT via `window.SpeechRecognition` / `window.webkitSpeechRecognition`. Both gated on feature detection. P2 priority | Browser support is uneven (Safari good, Firefox partial for STT). Ship W1–W3 and W5 first; W4 may defer if scope is tight | n |
| Test library | `@testing-library/react` + `@testing-library/dom` + `@testing-library/user-event` as devDeps (NOT currently in root `package.json` — only `@testing-library/react-native` is, in `mobile/`) | Vitest config already uses jsdom per `CONVENTIONS.md` (though `vitest.config.mts` currently sets `environment: 'node'` and `include: ['__test__/unit/**/*.test.ts']` — W5-foundation must switch the component glob to jsdom and add `*.tsx`) | n |
| Branch | `feat/web-mvp` (current branch — add commits here, do not create a separate branch per the user's instruction) | Keeps the web MVP work in one place | y |
| New Jira epic | `/sdd-tasks-jira` will create a new web-MVP epic (e.g., "EPIC 17: Web MVP Chat Enhancements") and publish W1–W5 as task issues under it | No web epic exists yet; the RN epic SCRUM-140 is RN-scoped | n |
| Persistence cadence | Debounce the write to `sessionStorage` (e.g., 300ms) on state change | Rapid refresh cycles / fast typing should not thrash the storage API | y |
| ADR | None yet — the web MVP has not been ADR'd | A follow-up ADR could record the web-stack choice (Next.js App Router + globals.css design system, no Tailwind/shadcn); this slice does not require it | n |

**Open questions:** two, neither blocking — (1) whether a follow-up backend slice adds `POST /feedback` (deferred here), and (2) whether W4 (Web Speech) ships in this slice or is split into its own follow-up (default: include as P2, may defer).

---

## User Stories

### P1: See that STEDI is working ⭐ — Jira TBD (W1)

**User Story**: As a user waiting for the assistant's reply, I want to see an animated typing indicator, so that I know STEDI is working and have not been abandoned.

**Acceptance Criteria**:

1. WHEN a chat turn is in flight (pending) THEN the ChatAssistant SHALL display an animated typing indicator (e.g., three pulsing dots) instead of the plain `"STEDI is thinking…"` text (WEBLOAD-01).
2. WHEN the indicator is shown THEN it SHALL be accessible — an `aria-live="polite"` region announcing "STEDI is typing" — per WCAG (WEBLOAD-02).
3. WHEN the request completes (success or failure) THEN the indicator SHALL be removed and replaced with the result (WEBLOAD-03).

### P1: Resume after a refresh ⭐ — Jira TBD (W2)

**User Story**: As a user who refreshes the tab mid-conversation, I want the chat to pick up where I left off, so that I do not lose my progress.

**Acceptance Criteria**:

1. WHEN the user sends a turn THEN the ChatAssistant SHALL persist `{ messages, currentStep, collected (excluding password), chatSessionId }` to `sessionStorage` under a stable key (WEBRESTORE-01).
2. WHEN the ChatAssistant mounts THEN IF persisted state exists it SHALL restore the transcript and step, resuming at the saved step (WEBRESTORE-02).
3. WHEN the restored step is `password_collection` THEN the password field SHALL be empty and the user SHALL be informed the password must be re-entered (never persisted) (WEBRESTORE-03).
4. WHEN registration completes successfully THEN the persisted session state SHALL be cleared from `sessionStorage` (WEBRESTORE-04).
5. WHEN the persisted `chatSessionId` yields a 408 on resume (expired server-side) THEN the client SHALL discard it and start a fresh session (WEBRESTORE-05).

### P2: Tell us if this helped — Jira TBD (W3)

**User Story**: As a user who just completed onboarding, I want to give quick feedback, so that STEDI can improve the guided signup.

**Acceptance Criteria**:

1. WHEN registration completes (after the success banner) THEN a feedback affordance SHALL appear asking "Was this onboarding helpful?" with a rating mechanism (WEBFEEDBACK-01).
2. WHEN the user submits feedback THEN the client SHALL record it (log-only — `console.info` in dev; backend route deferred). The submission SHALL NOT block the success state (WEBFEEDBACK-02).
3. WHEN the user dismisses without submitting THEN no feedback is recorded and dismissal does not block proceeding to signin (WEBFEEDBACK-03).
4. WHEN feedback is submitted or dismissed THEN the affordance SHALL close (WEBFEEDBACK-04).

### P2: Hear and speak the conversation — Jira TBD (W4)

> **Priority**: P2 — may be deferred if scope is tight. Browser support is uneven (Safari good, Firefox partial for STT).

**User Story**: As a user who prefers audio, I want the assistant's replies read aloud and to be able to speak my answers, so that I can use the chat without typing.

**Acceptance Criteria**:

1. WHEN `window.speechSynthesis` is available THEN a "Read aloud" affordance SHALL appear on each assistant reply, synthesizing speech from the reply text (WEBVOICE-01).
2. WHEN speech synthesis is unsupported THEN the affordance SHALL NOT be rendered (graceful degradation) (WEBVOICE-02).
3. WHEN `window.SpeechRecognition` (or `webkitSpeechRecognition`) is available THEN a voice-input affordance SHALL appear in the composer, allowing the user to speak their reply (WEBVOICE-03).

### P1: Know the web UI works ⭐ — Jira TBD (W5)

**User Story**: As a developer, I want component and browser tests for the web UI, so that changes to `AuthForm`, `ChatAssistant`, and `SiteHeader` (and the pages that use them) are verified and regressions are caught.

**Why P1 / highest value**: The web frontend currently has ZERO UI tests — Playwright specs only hit API `route.ts`, and there are no vitest component tests. Every other task in this slice adds behavior; without a test foundation, regressions slip through.

**Acceptance Criteria**:

1. WHEN `npm run test:unit` runs THEN vitest SHALL execute component tests for `AuthForm` (signin + signup modes, validation, feedback states) (WEBTEST-01).
2. WHEN `npm run test:unit` runs THEN vitest SHALL execute component tests for `ChatAssistant` (step progression, pending state, completion, error handling) (WEBTEST-02).
3. WHEN `npm run test:unit` runs THEN vitest SHALL execute component tests for `SiteHeader` (render, links, skip link) (WEBTEST-03).
4. WHEN the Playwright suite runs THEN a browser spec SHALL navigate to `/` and assert the hero, nav, and CTAs render (WEBTEST-04).
5. WHEN the Playwright suite runs THEN a browser spec SHALL navigate to `/signin` and `/signup` and assert the forms render with the expected fields (WEBTEST-05).
6. WHEN the Playwright suite runs THEN a browser spec SHALL navigate to `/chat` and assert the chat panel, initial assistant message, and composer render (WEBTEST-06).
7. WHEN the Playwright suite runs THEN a browser spec SHALL fill the signup form and submit, asserting the success/error feedback renders (mocked or against seeded data) (WEBTEST-07).
8. WHEN `npm run lint` runs THEN the new test files SHALL pass lint (no unused vars, import order correct) (WEBTEST-08).

---

## Edge Cases

- WHEN `sessionStorage` is disabled or the stored JSON is corrupt THEN the ChatAssistant SHALL fail gracefully and start a fresh session (covers WEBRESTORE-01/02).
- WHEN navigation interrupts an in-flight `speechSynthesis` utterance THEN the utterance SHALL be cancelled (not orphaned) on unmount.
- WHEN `SpeechRecognition` permission is denied or the API throws THEN the voice-input affordance SHALL be hidden and the text composer SHALL remain fully usable.
- WHEN the persisted `chatSessionId` yields a 408 on resume THEN the client discards it and starts fresh (WEBRESTORE-05).
- WHEN the user rapidly refreshes (rapid refresh cycles) THEN persistence SHALL be debounced so the storage API is not thrashed.
- WHEN the browser has no Web Speech API THEN no TTS/STT affordance renders (graceful degradation, WEBVOICE-02).
- WHEN the restored step is `password_collection` THEN the password is never restored from storage — the user is re-prompted (WEBRESTORE-03).

---

## Requirement Traceability

| Requirement ID | Story | Jira | Phase | Status |
| --- | --- | --- | --- | --- |
| WEBLOAD-01 | See that STEDI is working | TBD (new issue) | Tasks | Mapped |
| WEBLOAD-02 | See that STEDI is working | TBD (new issue) | Tasks | Mapped |
| WEBLOAD-03 | See that STEDI is working | TBD (new issue) | Tasks | Mapped |
| WEBRESTORE-01 | Resume after a refresh | TBD (new issue) | Tasks | Mapped |
| WEBRESTORE-02 | Resume after a refresh | TBD (new issue) | Tasks | Mapped |
| WEBRESTORE-03 | Resume after a refresh | TBD (new issue) | Tasks | Mapped |
| WEBRESTORE-04 | Resume after a refresh | TBD (new issue) | Tasks | Mapped |
| WEBRESTORE-05 | Resume after a refresh | TBD (new issue) | Tasks | Mapped |
| WEBFEEDBACK-01 | Tell us if this helped | TBD (new issue) | Tasks | Mapped |
| WEBFEEDBACK-02 | Tell us if this helped | TBD (new issue) | Tasks | Mapped |
| WEBFEEDBACK-03 | Tell us if this helped | TBD (new issue) | Tasks | Mapped |
| WEBFEEDBACK-04 | Tell us if this helped | TBD (new issue) | Tasks | Mapped |
| WEBVOICE-01 | Hear and speak the conversation | TBD (new issue) | Tasks | Mapped |
| WEBVOICE-02 | Hear and speak the conversation | TBD (new issue) | Tasks | Mapped |
| WEBVOICE-03 | Hear and speak the conversation | TBD (new issue) | Tasks | Mapped |
| WEBTEST-01 | Know the web UI works | TBD (new issue) | Tasks | Mapped |
| WEBTEST-02 | Know the web UI works | TBD (new issue) | Tasks | Mapped |
| WEBTEST-03 | Know the web UI works | TBD (new issue) | Tasks | Mapped |
| WEBTEST-04 | Know the web UI works | TBD (new issue) | Tasks | Mapped |
| WEBTEST-05 | Know the web UI works | TBD (new issue) | Tasks | Mapped |
| WEBTEST-06 | Know the web UI works | TBD (new issue) | Tasks | Mapped |
| WEBTEST-07 | Know the web UI works | TBD (new issue) | Tasks | Mapped |
| WEBTEST-08 | Know the web UI works | TBD (new issue) | Tasks | Mapped |

**Coverage:** 23 total, 23 mapped to tasks, 0 unmapped ✅ — WEBLOAD→W1, WEBRESTORE→W2, WEBFEEDBACK→W3, WEBVOICE→W4, WEBTEST→W5-foundation + W5-full (see `tasks.md`)

---

## Success Criteria

- [ ] `npm run test:unit` passes with new component tests for `AuthForm`, `ChatAssistant`, `SiteHeader`
- [ ] Playwright web UI specs pass (home, signin, signup, chat)
- [ ] `npm run lint && npm run typecheck && npm run build` green
- [ ] Manual browser walkthrough: typing indicator animates during pending, tab refresh restores the conversation (password re-prompted), feedback affordance appears after completion, TTS reads a reply aloud in a supporting browser
- [ ] No backend source, routes, or schema modified (feedback is log-only)