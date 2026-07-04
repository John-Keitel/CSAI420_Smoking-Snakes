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

- **Feature**: fix-npm-vulns / .specs/features/fix-npm-vulns/
- **Phase / Task**: Tasks T2 — RESOLVE RESIDUALS
- **Completed**: T1, T2
- **In-progress**: (none)
- **Next step**: Awaiting Execute-session Verifier; follow-up slice required to bump direct `nodemailer` from `^6.10.0` to `^9.0.3` with email smoke tests.
- **Blockers**: `nodemailer` direct dep cannot be overridden; `@auth/core` advisory is transitive via nodemailer.
- **Uncommitted files**: none
- **Branch**: jira-scrum-45
