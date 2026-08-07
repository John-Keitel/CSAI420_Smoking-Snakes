# STATE

## Decisions

<!--
Project-level decisions only (conventions, patterns, constraints, cross-cutting
tech choices). Append one AD-NNN entry per decision; never delete — supersede.
Feature-local decisions stay in the slice's design.md, not here.

Format:

### AD-001

- **Decision**: [what was decided — one sentence]
- **Reason**: [why this option was chosen]
- **Trade-off**: [what was given up]
- **Scope**: [which features / packages / layers this governs]
- **Date**: YYYY-MM-DD
- **Status**: active | superseded by AD-NNN
-->

### AD-001

- **Decision**: Accept `nodemailer@^6.10.0` as a residual vulnerability in the fix-npm-vulns slice because it cannot be overridden.
- **Reason**: `nodemailer` is a direct dependency of `cs420-api` at `^6.10.0`. `npm` rejects overriding a direct dependency with `EOVERRIDE`, so the overrides-only strategy in this slice cannot reach it.
- **Trade-off**: The high-severity advisories remain active until a follow-up slice bumps the direct dependency; no source code or breaking change is introduced here.
- **Scope**: `package.json` dependencies, `nodemailer`, `@auth/core` transitive chain.
- **Package / resolved version**: `nodemailer@6.10.0`
- **Advisory IDs**:
  - https://github.com/advisories/GHSA-mm7p-fcc7-pg87
  - https://github.com/advisories/GHSA-rcmh-qjqh-p98v
  - https://github.com/advisories/GHSA-c7w3-x93f-qmm8
  - https://github.com/advisories/GHSA-vvjj-xcjg-gr5g
  - https://github.com/advisories/GHSA-268h-hp4c-crq3
  - https://github.com/advisories/GHSA-wqvq-jvpq-h66f
  - https://github.com/advisories/GHSA-r7g4-qg5f-qqm2
  - https://github.com/advisories/GHSA-p6gq-j5cr-w38f
- **Override attempt(s)**: `nodemailer@^9.0.3` — rejected by npm (`EOVERRIDE`) because `nodemailer` is a direct dependency.
- **Failure mode**: `EOVERRIDE` on direct dependency; overrides cannot pin a package that is also declared in `dependencies`.
- **Recommended next step**: Open a follow-up slice to bump the direct `nodemailer` dependency from `^6.10.0` to `^9.0.3` and run email smoke tests to validate `@auth/core` integration.
- **Date**: 2026-07-04
- **Status**: active

### AD-002

- **Decision**: Treat the `@auth/core` audit finding as resolved-by-proxy when `nodemailer` is bumped; no separate override is applied.
- **Reason**: `npm audit` flags `@auth/core` only because it depends on the vulnerable `nodemailer@6.10.0`. `@auth/core` itself has no independent advisory in this report. Bumping the direct `nodemailer` dependency to `^9.0.3` in a follow-up slice will remove `@auth/core`'s transitive exposure without altering `@auth/core`'s major version in this slice.
- **Trade-off**: The moderate-severity finding remains on the audit until the nodemailer follow-up slice lands; an alternative would be to evaluate bumping or downgrading `@auth/core` itself, but that is explicitly out of scope for this overrides-only slice.
- **Scope**: `package.json` dependencies, `@auth/core`, `nodemailer` transitive chain.
- **Package / resolved version**: `@auth/core@0.38.0` (depends on `nodemailer@6.10.0`)
- **Advisory IDs**: Transitive via `nodemailer` — see AD-001 for GHSA list. No independent GHSA for `@auth/core` was reported by `npm audit`.
- **Override attempt(s)**: No override attempted; the vulnerable path is through `nodemailer`, which is a direct dependency and cannot be overridden (`EOVERRIDE`).
- **Failure mode**: Cannot override transitive parent without first resolving the direct-dependency block on `nodemailer`.
- **Recommended next step**: Resolve automatically in the same follow-up slice that bumps direct `nodemailer` to `^9.0.3`; alternatively, evaluate bumping `@auth/core` to a version that natively supports `nodemailer@9.x` if smoke tests reveal incompatibility.
- **Date**: 2026-07-04
- **Status**: active

### AD-003

- **Decision**: Epic 3 V1 uses STEDI pass-through only — no Kafka, SNS, SQS, or EventBridge in this repository for real-time sensor data.
- **Reason**: PRFAQ Step 4 is “transmit to cloud API for analysis”; the IVR TDD defers dedicated queueing to V2 and uses STEDI ingestion plus polling `/devices/updates/recent`. Assignment 1.7 scores via STEDI `/riskscore`.
- **Trade-off**: No local stream processing or offline buffering in V1; latency and availability depend on STEDI.
- **Scope**: SCRUM-17 / `.specs/features/realtime-data-path/`, STEDI sensor and score routes.
- **Date**: 2026-07-11
- **Status**: active

### AD-004

- **Decision**: The EPIC 12 React Native client is an Expo app colocated at `mobile/` inside this repository, on an Expo SDK 54 / RN 0.81 / React 19 baseline, tested with `@testing-library/react-native` 13, reading its API base URL from `Constants.expoConfig.extra.apiBaseUrl`.
- **Reason**: The spec-driven flow is anchored to one repository — `sdd-execute-jira` forks worktrees from a slice branch here and `sdd-pr-review` runs against a PR on this repo's remote. A separate mobile repo would split `.specs/` artifacts from the code they specify and break that chain. `mobile/` is not an npm workspace of the root package; it keeps its own `package.json`, lockfile, and Jest config.
- **Trade-off**: The repo is no longer single-purpose and now carries two runtimes and two dependency trees. Root toolchain configs must permanently exclude `mobile/` (`tsconfig.json` `exclude`, `.prettierignore`, `eslint.config.mjs` `ignores`, `.dockerignore`) or `npm run typecheck` and the CI `prettier --check .` gate break. Root `npm audit --omit=dev` does not cover mobile dependencies; a separate CI job runs the mobile suite.
- **Scope**: `mobile/**`, root toolchain configs, `.github/workflows/ci.yml`, SCRUM-140 / `.specs/features/onboarding-chat-ui/`.
- **ADR**: `docs/engineering/adr/001-mobile-client-colocated-in-api-repo.md`
- **Date**: 2026-08-02
- **Status**: active

## Handoff

<!--
Pause snapshot (~500 tokens, overwritten each pause). Replace this section only;
never touch ## Decisions above.

Format:
- **Feature**: [feature name / .specs path]
- **Phase / Task**: [e.g., Phase 2 / T4 — implement repository layer]
- **Completed**: [comma-separated task IDs or "none"]
- **In-progress** (file:line): [e.g., src/billing/subscription.service.ts:88]
- **Next step**: [one sentence — exactly what to do next]
- **Blockers**: [none | description]
- **Uncommitted files**: [list or "none"]
- **Branch**: [git branch name]
-->

- **Feature**: onboarding-chat-ui (EPIC 12 / SCRUM-140) / .specs/features/onboarding-chat-ui/
- **Phase / Task**: EXECUTION COMPLETE — T1–T6 implemented and committed on `feat/onboarding-chat-ui`. Awaiting review/PR.
- **Completed**: Planning (ADR-001 + AD-004, TDD, spec.md 45 reqs, design.md, tasks.md; SCRUM-90..94 enriched; SCRUM-145 created). Execution: T1 Expo scaffold + chatClient + stepRules + 5 toolchain fences + CI job (527eadb); T2 Need Help entry point (cf5a90b); T3 ChatSheet session owner (9629d8c); T4 MessageList (5266e2a); T5 InputBar + validation + registration (d0c1155); T6 accessibility (a75eefd). **149 mobile tests pass; root format/lint/typecheck/205 unit tests/build all green.**
- **In-progress**: (none)
- **Next step**: Open a PR for `feat/onboarding-chat-ui` and run `/sdd-execute-jira`'s Verifier or `sdd-pr-review`. Then do the manual device pass the spec's Success Criteria require — it is the only unverified part (see Blockers).
- **Blockers**: none blocking, but three things are explicitly NOT yet verified: (1) **no manual device run** — the flow has never been exercised against a live API, only against mocked transports, so `extra.apiBaseUrl` must be pointed at a LAN address or the deployed host and walked end to end; (2) VoiceOver/TalkBack and max-font-size passes are unautomatable and outstanding (A11Y-03/04 have unit coverage only); (3) the plaintext-password defect in `/chat/continue-session` is unfixed by design — the client masks and withholds it, but the server still persists it, and a follow-up backend slice is needed. Also open: whether SCRUM-99 is closed as superseded.
- **Uncommitted files**: none
- **Branch**: `feat/onboarding-chat-ui` (branched from `jira-scrum-140`; note the repo's two-session protocol was explicitly waived by the user for this slice)

---

- **Feature**: chat-assisted-registration / .specs/features/chat-assisted-registration/
- **Phase / Task**: EXECUTION COMPLETE — T1-T6 committed (e6fc145, e4ba792, 66744c1, dc5d13a, d29f560, 3e414a3), T7 green
- **Completed**: T1 schemas+formatter; T2 ChatRegistrationSession model+migration (hand-written, matches prisma output); T3 POST /user/chat-assisted (phone optional, 'N/A' default — suite matrix omits phone); T4 POST /escalate-registration (issueType SLA map, technical_difficulties → "15-30 minutes"); T5 POST /chat/continue-session (rule-based state machine, DB-persisted); T6 DELETE /user/[userId]; T7 official week5 suite **17/17 PASS** against deployed https://cs420-api.asf0.dev (server root@192.168.0.234, docker compose); Verifier PASS 21/21 ACs, no surviving mutants; EPIC 14 register-chat untouched
- **In-progress**: (none)
- **Next step**: none — slice delivered. Follow-up note: pending escalation work from prior session was landed as chore 515808f (deploy dependency of T4); prod DB migrated via compose migrate service.
- **Blockers**: none
- **Uncommitted files**: `.claude/`, `weekly-assignment-answers.md` (personal, left out of commits)
- **Branch**: main (pushed to origin)

---

- **Feature**: session-token-expiry-distinction / .specs/features/session-token-expiry-distinction/
- **Phase / Task**: Planning — spec.md + tasks.md drafted, awaiting human review
- **Completed**: spec.md, tasks.md (source: PR #64 review comment by ljm234)
- **In-progress**: (none)
- **Next step**: Human reviews/edits slice docs, then runs `/sdd-tasks-jira` to publish task issues; execution later in a separate `/sdd-execute-jira` session on branch `fix/session-token-expiry-distinction`.
- **Blockers**: none
- **Uncommitted files**: `.specs/features/session-token-expiry-distinction/{spec.md,tasks.md}` (+ this STATE.md edit) — planning session, not committed
- **Branch**: main (no code branch created during planning)
