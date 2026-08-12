# Onboarding Chat UI V2 (EPIC 12) Specification

**Slice**: `.specs/features/onboarding-chat-ui-v2/`
**Status**: Draft
**Epic**: [SCRUM-140](https://csai420.atlassian.net/browse/SCRUM-140) — EPIC 12: React Native In-App Chat UI & Accessibility
**Depends on**: `onboarding-chat-ui` slice (delivered — SCRUM-145/90-94 complete, `mobile/` app exists with `ChatSheet`/`MessageList`/`InputBar`/`accessibility.js`; reuse and extend, do not break), [ADR-001](../../../docs/engineering/adr/001-mobile-client-colocated-in-api-repo.md), [TDD 2026-08-onboarding-chat-mobile-client](../../../docs/engineering/tdd/2026-08-onboarding-chat-mobile-client.md)

## Problem Statement

The v1 slice delivered the conversational signup flow but explicitly deferred five enhancements
(SCRUM-95 through SCRUM-99). The chat surface today has a plain `pending` text state, no voice I/O
for visually impaired users, no session restore after app minimization, and no feedback collection
mechanism. SCRUM-99 ("Write Jest component tests") was a standalone task in Jira but is absorbed into
each task that changes behavior per `.specs/codebase/CONVENTIONS.md` and the v1 precedent — tests
ship inside the task, not as a separate deliverable.

This slice delivers those four enhancements as extensions to the existing `mobile/` app, reusing the
delivered `ChatSheet` session owner and its presentational children without breaking them.

## Goals

- [ ] A visually impaired user can hear assistant replies spoken aloud and halt playback
- [ ] The chat shows an animated typing indicator while a turn is in flight instead of static text
- [ ] A user who accidentally backgrounds the app mid-conversation resumes where they left off
- [ ] After completing registration the user can submit quick feedback on the onboarding experience
- [ ] The API's existing CI gates remain green with the enhanced `mobile/` app present

## Out of Scope

| Feature | Reason |
| --- | --- |
| Any change to backend source, routes, or schema | Delivered and covered by the Week 5 suite; reuse only. EXCEPTION: feedback is log-only (see FEEDBACK-04 assumption) — no backend route is added |
| Web client | `feat/web-mvp` is a separate unspecced effort |
| A standalone "write Jest tests" task | SCRUM-99 — superseded; tests ship inside the task that changes behavior, per `.specs/codebase/CONVENTIONS.md` and v1 precedent; recommend closing as superseded |
| Full ASR (automatic speech recognition) cloud integration | V1 uses on-device TTS via `expo-speech` for assistant-reply playback; cloud STT is out of scope. On-device STT INPUT is documented as degraded/deferred if no viable SDK 54 package exists (see Assumptions) |
| Push notification re-engagement | Separate epic |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Feedback collection | Log-only via `console.info` (no logger exists in `mobile/` — `getAppLogger` from `src/lib/logger` is API-side and the app is fenced). NO backend route added (preserves v1 read-only constraint) | Avoids a backend slice dependency; feedback is collected but not persisted server-side in V1 | n |
| Session restore persistence | `@react-native-async-storage/async-storage` (not currently a dep in `mobile/package.json` — must be added). Persist transcript + currentStep + collected + chatSessionId + lastActivity, EXCLUDING password | v1 design flagged credential handling as a blocker for persistence ("must resolve credential handling before it can persist the accumulator"); password must never be persisted client-side at rest | n |
| Speech-to-text (TTS playback) | `expo-speech` for assistant reply playback. Not currently a dep — must be added | On-device TTS is available on iOS and Android via `expo-speech`; no cloud dependency | n |
| Speech-to-text (STT input) | React Native has no built-in STT. `expo-speech-recognition` is the candidate, but its SDK 54 compatibility is unverified. Default: ship TTS only in V1; mark STT INPUT as degraded/deferred (documented in Out of Scope) | Avoids a heavy/uncertain dep on SDK 54; TTS covers the visually-impaired read-aloud need; STT input is an enhancement, not a blocker | n |
| Typing animation | React Native `Animated` API (already available, no new dep) | Replace the plain `pending` text in `ChatSheet` with animated pulsing dots | y |
| SCRUM-99 | Recommend closing as superseded — tests ship inside each task (T7-T10), per `CONVENTIONS.md` and v1 precedent | Matches v1's absorption of tests into the task that changes behavior | n |
| Branch | Forks from `feat/onboarding-chat-ui` (v1 branch, not yet merged to main) | v1 is delivered but unmerged; v2 extends its files in place | n |
| Reopen after restore | If a restored session is at `completion`, show the completion/feedback state; if mid-flow, resume at the saved step | Mirrors v1's `SHEET-04` step-adoption but sourced from persisted state | n |
| `expo-av` | Not needed for V1 — `expo-speech` handles TTS playback natively; no audio recording or file playback is required | Avoids an unnecessary dep; `expo-av` would only be needed for recorded audio, which is out of scope | y |

**Open questions:** five, all logged here and none blocking this slice — (1) whether the team
confirms log-only feedback (no backend route), (2) whether `@react-native-async-storage/async-storage`
is acceptable as the persistence layer, (3) whether `expo-speech-recognition` is viable on SDK 54 for
STT input or STT is deferred, (4) whether SCRUM-99 is closed as superseded, (5) whether v2 forks from
the unmerged v1 branch.

---

## User Stories

### P1: Hear the conversation — SCRUM-95

**User Story**: As a visually impaired user, I want assistant replies spoken aloud, so that I can
follow the onboarding conversation without reading the screen.

**Why P1**: SCRUM-95 is explicitly for visually impaired users; TTS playback is the core accessible
affordance the v1 slice deferred. v1 already announces replies via `AccessibilityInfo.announceForAccessibility`
(A11Y-03), but a screen reader is not always present or configured — a dedicated "Read aloud" control
gives the user an explicit, on-demand voice path.

**Acceptance Criteria**:

1. WHEN the user activates a "Read aloud" control on an assistant reply THEN the client SHALL synthesize speech from the reply text via TTS (`expo-speech`) (VOICE-01).
2. WHEN TTS is playing THEN a visible and announced "Stop" control SHALL be available to halt playback (VOICE-02).
3. WHEN speech synthesis is unsupported on the device THEN the "Read aloud" control SHALL NOT be presented (graceful degradation) rather than failing at runtime (VOICE-03).
4. WHEN a screen reader is active (`AccessibilityInfo.isScreenReaderEnabled`) THEN new assistant replies SHALL be announced AND a "Read aloud" affordance SHALL be visible on each assistant bubble (builds on A11Y-03 from v1) (VOICE-04).

> **Note**: STT (speech-to-text INPUT) is P2/deferred — on-device STT has no viable built-in on SDK 54
> without a heavy/uncertain dep (`expo-speech-recognition`). Documented in Out of Scope. If a viable
> package is confirmed during execution, VOICE-05/06 for STT input MAY be added as P2 — but V1 ships
> TTS only.

### P1: See that STEDI is working — SCRUM-96

**User Story**: As a user waiting for the assistant's reply, I want to see that the system is
working, so that I know the conversation has not stalled.

**Why P1**: The v1 surface shows plain `pending` text (the InputBar's send button reads `...` while
a request is in flight). A static indicator reads as a hang; an animated one communicates that the
system is actively generating a response.

**Acceptance Criteria**:

1. WHEN a turn is in flight (`pending`) THEN the chat surface SHALL display an animated typing indicator (e.g., three pulsing dots) instead of plain static text (LOAD-01).
2. WHEN the indicator is shown THEN it SHALL be announced to screen readers as "STEDI is typing" (`accessibilityLiveRegion` polite) (LOAD-02).
3. WHEN the request completes (success or failure) THEN the indicator SHALL be removed and replaced with the result (LOAD-03).

### P1: Resume where I left off — SCRUM-97

**User Story**: As a user who accidentally minimized the app mid-conversation, I want the chat to
resume where I was, so that I do not lose my progress and have to start over.

**Why P1**: v1 has no persistence — state dies with the sheet. A dismissed sheet restarts from
scratch (SHEET-07). Accidental minimization during a six-turn signup flow is a common mobile failure
mode; restore prevents data loss.

**Acceptance Criteria**:

1. WHEN the app is minimized/backgrounded mid-conversation THEN the chat state (transcript, currentStep, collected, chatSessionId, lastActivity) SHALL be persisted to AsyncStorage, EXCLUDING the password field (RESTORE-01).
2. WHEN the app is reopened to the signup screen THEN IF a persisted session exists and has NOT expired (`lastActivity` within 30 min) THEN the chat surface SHALL resume at the persisted step with the persisted transcript (RESTORE-02).
3. WHEN the persisted session has expired (`lastActivity` older than 30 min) THEN the client SHALL discard it and start a fresh session on next "Need Help?" activation (RESTORE-03).
4. WHEN a session is restored THEN the password field SHALL be empty (re-collected) even if the persisted step was `password_collection`, and the user SHALL be informed that the password must be re-entered (RESTORE-04).
5. WHEN registration completes successfully THEN the persisted session state SHALL be cleared from AsyncStorage (RESTORE-05).

### P2: Tell us if this helped — SCRUM-98

**User Story**: As a user who just completed onboarding, I want to give quick feedback, so that the
team can improve the experience for future users.

**Why P2**: Feedback collection is valuable but not on the critical registration path. It appears
only after success, so it never blocks account creation.

**Acceptance Criteria**:

1. WHEN registration completes (after the success banner) THEN a feedback affordance SHALL be presented asking "Was this onboarding helpful?" with a clear rating mechanism (e.g., thumbs up/down or 1-5) (FEEDBACK-01).
2. WHEN the user submits feedback THEN the client SHALL record it via `console.info` (log-only, no backend route in V1 per the assumption — no logger exists in `mobile/`) (FEEDBACK-02).
3. WHEN the user dismisses the feedback without submitting THEN no feedback SHALL be recorded and the dismissal SHALL not block the success state (FEEDBACK-03).
4. WHEN feedback is submitted or dismissed THEN the modal SHALL close and the user SHALL be able to proceed to sign in (FEEDBACK-04).

---

> **SCRUM-99 ("Write Jest component tests") is superseded.** Per `.specs/codebase/CONVENTIONS.md`
> ("Tests are part of the task that changes behavior — not separate tasks") and the v1 precedent
> (tests shipped inside T1-T6, never as a standalone task), SCRUM-99 has no story and no task in this
> slice. Tests ship inside T7-T10. Recommend closing SCRUM-99 as superseded.

---

## Edge Cases

- WHEN TTS playback is interrupted by navigation or sheet dismissal THEN playback SHALL stop (`voiceController.stop()` on unmount) rather than continuing to speak over the next screen.
- WHEN AsyncStorage is full or returns corrupt data THEN the client SHALL fail gracefully — discard the persisted state, log a warning, and start a fresh session (never crash on restore).
- WHEN a restored session's `chatSessionId` no longer exists server-side (408 on resume) THEN the client SHALL discard the persisted state and start a fresh session (RESTORE-03).
- WHEN rapid minimize/restore cycles occur THEN persistence SHALL be debounced (e.g., a short timeout or `AppState` listener with a trailing save) so that back-to-back backgrounding does not thrash AsyncStorage writes.
- WHEN a restored session is at `completion` THEN the client SHALL show the completion/feedback state rather than re-sending the opener.

---

## Requirement Traceability

| Requirement ID | Story | Jira | Phase | Status |
| --- | --- | --- | --- | --- |
| VOICE-01 | Hear the conversation | SCRUM-95 | Tasks | Mapped |
| VOICE-02 | Hear the conversation | SCRUM-95 | Tasks | Mapped |
| VOICE-03 | Hear the conversation | SCRUM-95 | Tasks | Mapped |
| VOICE-04 | Hear the conversation | SCRUM-95 | Tasks | Mapped |
| LOAD-01 | See that STEDI is working | SCRUM-96 | Tasks | Mapped |
| LOAD-02 | See that STEDI is working | SCRUM-96 | Tasks | Mapped |
| LOAD-03 | See that STEDI is working | SCRUM-96 | Tasks | Mapped |
| RESTORE-01 | Resume where I left off | SCRUM-97 | Tasks | Mapped |
| RESTORE-02 | Resume where I left off | SCRUM-97 | Tasks | Mapped |
| RESTORE-03 | Resume where I left off | SCRUM-97 | Tasks | Mapped |
| RESTORE-04 | Resume where I left off | SCRUM-97 | Tasks | Mapped |
| RESTORE-05 | Resume where I left off | SCRUM-97 | Tasks | Mapped |
| FEEDBACK-01 | Tell us if this helped | SCRUM-98 | Tasks | Mapped |
| FEEDBACK-02 | Tell us if this helped | SCRUM-98 | Tasks | Mapped |
| FEEDBACK-03 | Tell us if this helped | SCRUM-98 | Tasks | Mapped |
| FEEDBACK-04 | Tell us if this helped | SCRUM-98 | Tasks | Mapped |
| SCRUM-99 | *(superseded — tests ship inside T7-T10)* | SCRUM-99 | — | Superseded |

**Coverage:** 16 total requirements mapped to tasks, 1 superseded ✅ — VOICE→T7, LOAD→T8, RESTORE→T9, FEEDBACK→T10, SCRUM-99 superseded (see `tasks.md`)

---

## Success Criteria

- [ ] `cd mobile && npx jest` passes (149 existing v1 tests + new v2 tests, no regressions)
- [ ] Root gates green with enhanced `mobile/` present: `npm run format`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`
- [ ] Manual device walkthrough: "Read aloud" speaks an assistant reply and stops on tap; animated dots show while a turn is in flight; backgrounding mid-flow and reopening resumes at the saved step; after registration the feedback modal records a rating
- [ ] VoiceOver and TalkBack announce "STEDI is typing" and the read-aloud controls; every new control is labeled
- [ ] At maximum OS font size no chat text is clipped, truncated, or overlapped (v1 accessibility preserved)
- [ ] `chat-assisted-registration` and `continue-session` backend remain untouched — Week 5 suite still passes
- [ ] No password is ever persisted to AsyncStorage (RESTORE-01/04 verified)