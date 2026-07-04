# STEDI Voice IVR PRD

| Field        | Value                                                             |
| ------------ | ----------------------------------------------------------------- |
| Product      | STEDI Voice - Hands-Free Balance and Mobility Testing via IVR     |
| Status       | Draft                                                             |
| Source       | PRFAQ 1.4 - IVR Prototype; imported from `PRD-stedi-voice-ivr.md` |
| Last updated | 2026-07-04                                                        |
| Owner        | Product                                                           |

## Overview

STEDI Voice is a hands-free automated phone assistant that allows users to complete
their balance and mobility exercise by calling a designated phone number. The system
authenticates the caller, guides them through the balance test by voice, collects
sensor data from the user's IoT device, processes the result through the existing
cloud API, and announces the resulting balance index score during the same call.

The initial product direction is an IVR prototype that removes the need for a
smartphone app during the exercise while preserving score consistency with the
current mobile app flow.

## Problem

Many STEDI users struggle with mobile app interactions because of physical
limitations, technical barriers, or personal preference. The current flow requires
users to authenticate through SMS, navigate a mobile app, and manually initiate the
exercise.

That creates friction for elderly users and users who need or prefer hands-free
interaction. The app dependency limits accessibility, reduces completion rates, and
can prevent otherwise eligible users from completing a balance test.

## Goals

- Increase accessibility by allowing users to complete balance testing without a
  smartphone app.
- Enable a hands-free end-to-end exercise flow through a phone call.
- Preserve parity with the mobile app by producing balance index scores that are
  consistent with the existing flow.
- Reduce avoidable abandonment caused by app navigation, device compatibility,
  updates, or other mobile usability issues.
- Validate whether voice-first testing improves completion for elderly and
  accessibility-focused users.

## Non-Goals

- Replace or deprecate the mobile app.
- Support exercises beyond the existing balance and mobility test.
- Add smart-speaker integrations such as Alexa or Google Home.
- Add multilingual IVR support in the initial prototype.
- Use voice recognition or speaker identification as the authentication method.
- Select final telephony, messaging, queueing, or event-processing vendors in the
  PRD.

## Target Users

- Elderly STEDI users who find smartphone interactions difficult.
- Users with physical limitations who benefit from hands-free guided testing.
- Users who have technical difficulty with the app due to compatibility,
  connectivity, updates, or navigation.
- Users who prefer a voice-first experience even when the app is available.

## User Journey

1. The user calls the designated STEDI Voice phone number.
2. The IVR greets the user and explains that it will guide them through the balance
   test.
3. The user completes identity verification through SMS-based 2FA plus patient name
   and date of birth confirmation.
4. The IVR verifies that the user's phone session and IoT device are ready for the
   exercise.
5. The IVR gives clear, paced verbal instructions for the balance test.
6. The IoT device collects sensor data without requiring the mobile app.
7. The collected data is processed through the cloud API.
8. The IVR announces the balance index score and any appropriate verbal feedback
   before ending the call.

## User Stories

- As an elderly STEDI user, I want to call a phone number to complete my balance
  test so that I do not need to navigate a smartphone app.
- As a user with limited mobility, I want the IVR to guide me with clear verbal
  prompts so that I can complete the test hands-free.
- As a STEDI user, I want the system to verify my identity before sharing my score
  so that my health-related information stays private.
- As a STEDI user, I want the phone flow to confirm that my IoT device is ready so
  that I know the exercise will be recorded.
- As a STEDI user, I want to hear my balance score during the same call so that I
  get immediate feedback.
- As a STEDI operator, I want IVR results to match app-based results so that the new
  channel can be trusted.

## Requirements

### Call Handling

- `PRD-SV-001`: The system shall answer inbound calls to a designated STEDI Voice
  phone number with an automated voice greeting.
- `PRD-SV-002`: The system shall guide callers using clear, paced verbal prompts
  suitable for elderly and accessibility-focused users.
- `PRD-SV-003`: The system shall gracefully handle call drops by allowing users to
  call back and resume or restart the flow.

### Authentication

- `PRD-SV-004`: The system shall authenticate callers with SMS-based 2FA using a
  one-time code read back by voice or entered by keypad.
- `PRD-SV-005`: The system shall also ask for patient name and date of birth before
  disclosing any score or health-related result.
- `PRD-SV-006`: Authentication shall complete entirely within the voice call and
  shall not require a graphical interface.
- `PRD-SV-007`: The system shall limit failed authentication attempts and fail
  securely.

### Guided Exercise

- `PRD-SV-008`: The IVR shall deliver step-by-step verbal instructions for the
  balance and mobility test.
- `PRD-SV-009`: The IVR flow shall trigger sensor data collection on the user's IoT
  device without requiring the mobile app.
- `PRD-SV-010`: Before the exercise starts, the IVR shall verify that the user's
  phone session and IoT device are ready for data collection.
- `PRD-SV-011`: The IVR shall confirm when data collection starts and when it
  completes.

### Scoring And Feedback

- `PRD-SV-012`: Sensor data collected through the IVR flow shall be sent to the
  existing cloud API for balance index analysis.
- `PRD-SV-013`: The IVR shall retrieve and announce the balance index score during
  the same call.
- `PRD-SV-014`: The IVR shall provide appropriate verbal feedback based on the
  score when feedback is available.
- `PRD-SV-015`: If scoring fails or times out, the IVR shall inform the user and
  offer a retry or follow-up path.

### Quality Attributes

- `PRD-SV-016`: IVR-based scores shall be consistent with mobile app scores for the
  same exercise.
- `PRD-SV-017`: The score shall be announced with low enough latency that users can
  reasonably wait on the line after completing the exercise.
- `PRD-SV-018`: The phone-to-device and device-to-cloud flow shall tolerate
  transient failures without silently losing exercise data.
- `PRD-SV-019`: Identity, sensor, and health-related data shall be protected in
  transit and at rest.
- `PRD-SV-020`: The IVR experience shall assume no visual interface is available.

## Success Metrics

| Metric                 | Definition                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------- |
| Completion rate        | Percentage of IVR callers who complete authentication, exercise, and score announcement |
| Adoption               | Percentage of eligible STEDI users who try or repeatedly use the IVR channel            |
| Time to score          | Average elapsed time from call initiation to score announcement                         |
| Score parity           | Consistency between IVR-based scores and mobile app scores for comparable tests         |
| Authentication success | Percentage of legitimate callers who complete verification without support intervention |
| Abandonment            | Percentage of calls abandoned before exercise start or before score announcement        |

## Candidate Slices

The following slices are product-level candidates only. They identify user-visible
increments and should be refined through the repo's slice planning flow before
implementation.

1. A caller can reach the STEDI Voice number and hear an accessible guided greeting.
2. A caller can complete SMS-based 2FA and patient verification inside the IVR flow.
3. An authenticated caller can verify that their IoT device is ready for a balance
   test.
4. An authenticated caller can complete one guided balance test by voice while
   sensor data is collected.
5. A caller can hear a balance index score during the same call after the test is
   processed.
6. A caller receives clear recovery guidance when authentication, device readiness,
   scoring, or the call itself fails.

## Risks

| Risk                                                           | Impact                                                     | Mitigation Direction                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Unreliable communication between the phone flow and IoT device | The test cannot complete or sensor data may be missing     | Add readiness checks, retries, and clear fallback paths                          |
| Authentication friction over voice                             | Legitimate users abandon before starting                   | Keep prompts short, support keypad entry, and limit retries clearly              |
| Event or scoring latency                                       | Users wait on the line or hang up before receiving a score | Design for real-time processing, waiting states, timeouts, and follow-up options |
| Score inconsistency between channels                           | Users and operators lose trust in IVR results              | Validate IVR scores against mobile app results during prototype and beta testing |
| Health information disclosed to the wrong caller               | Privacy and compliance risk                                | Require 2FA plus patient verification before announcing scores                   |

## Dependencies And Assumptions

- The existing cloud API can process balance test data collected outside the mobile
  app flow.
- The IoT device can be triggered, paired, or otherwise made ready for collection
  without requiring mobile app interaction during the call.
- SMS 2FA remains an acceptable authentication factor for the target users.
- Product, engineering, and compliance stakeholders will review score disclosure,
  authentication, and health-data handling before beta use.
- A TDD is required before implementation because this work spans telephony,
  authentication, IoT integration, event processing, cloud API integration,
  reliability, and security concerns.

## Open Questions

- Should callers be allowed to resume an interrupted exercise, or should call drops
  always restart the test?
- What is the maximum acceptable wait time between exercise completion and score
  announcement?
- What follow-up path should be offered when scoring fails: retry during the call,
  callback, SMS, support handoff, or app fallback?
- What exact score feedback is appropriate to announce verbally, and does it vary
  by score band?
- What patient verification wording is acceptable for accessibility, privacy, and
  compliance review?
- How should the IVR detect or confirm IoT device readiness for the prototype?

## Next Steps

1. Review and approve this PRD with product and compliance stakeholders.
2. Create a TDD under `docs/engineering/tdd/` to settle architecture, contracts,
   external dependencies, reliability, observability, and security design.
3. Use the approved PRD and TDD to create candidate slice epics with
   `sdd-slicer-jira`.
4. Select the first slice and create `.specs/features/[slice]/spec.md`,
   `design.md` if needed, and `tasks.md` through the planning flow.
