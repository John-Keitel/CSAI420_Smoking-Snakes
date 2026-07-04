# Fix npm Vulnerabilities Specification

## Problem Statement

`npm audit` reports **20 vulnerabilities** (1 low, 5 moderate, 12 high, 2 critical) across
production and dev dependencies in `cs420-api`. Affected packages include `form-data` (critical),
`vitest` (critical), `nodemailer`, `bcrypt`, `tar`, `vite`, `ws`, `playwright`, `postcss`, and
others. Most are transitive; three direct deps (`bcrypt`, `nodemailer`, `@auth/core`) currently
resolve only via a breaking major bump, and `postcss`/`next` resolves only via a nonsensical
downgrade that the npm resolver computes because Next 16 pins its own PostCSS internally.

## Goals

- [ ] Zero vulnerabilities reported by `npm audit` (exit code 0).
- [ ] No direct dependency receives a major version bump in this slice.
- [ ] No source code changes — `package.json` `overrides` and non-breaking dev-dep bumps only.
- [ ] Every override pin is reproducible from a single source of truth in `package.json`.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                                       | Reason                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Bumping `bcrypt` 6.x                          | Major bump on a direct dep — deferred per user decision (overrides-only strategy).          |
| Bumping `nodemailer` 9.x                      | Major bump on a direct dep — deferred per user decision (overrides-only strategy).          |
| Downgrading `@auth/core` 0.38 → 0.34.3        | Major downgrade on a direct dep — deferred; risky and unnecessary for the override path.    |
| Downgrading/altering `next` 16                | The `next@9.3.3` "fix" npm proposes is a downgrade of the framework — explicitly rejected.  |
| Editing application source code               | This slice is supply-chain only; no `src/` or `app/` changes.                                |
| Replacement libraries (e.g. `bcrypt`→`argon2`) | Architectural change — out of scope for a vuln-fix slice.                                    |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here — nothing is left silently unclear.

| Assumption / decision                                   | Chosen default                                               | Rationale                                                                                                                              | Confirmed? |
| ------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Target vuln posture                                     | Zero vulns (`npm audit` exit 0)                              | User-selected strict posture.                                                                                                         | y          |
| Strategy for fixes                                      | `npm` `overrides` field on transitive deps; non-breaking bumps on dev deps permitted | User-selected: "overrides only". We additionally allow non-major dev-dep bumps (`vitest` 3.1.1→3.2.6) where npm itself reports the fix as non-breaking, since the user's "no major on direct deps" rule binds the direct deps named in Out of Scope, not trivial patch-level dev bumps. | y          |
| `postcss` (transitive under `next`)                    | Override `postcss` to `^8.5.10`                              | User-selected. Next 16 bundles its own PostCSS pipeline; npm's only computed fix is a framework downgrade, which is nonsense. An override forces the patched version everywhere postcss is resolved, including next's bundled copy if it dereferences the Hoisted range. NFC if next pins an exact internal version that ignores the override — see Known Residual section below. | y          |
| `tar` / `@mapbox/node-pre-gyp` (under `bcrypt`)         | Override `tar` to `^7.5.16` and override `@mapbox/node-pre-gyp` if needed | `bcrypt@5.1.1`'s pre-gyp install-time dep on `tar` is the only vector. `tar@7` may have API drift from `tar@6` that `@mapbox/node-pre-gyp@1.0.11` expects. If override is incompatible, the Execute session falls back to overriding only `tar` and accepting the residual, OR escalating to a `bcrypt@6` major bump on this DIRECT dep — that escalation is a deferred Execute-session decision, not a planning one. | n (deferred) |
| `nodemailer` / `@auth/core`                             | Override `nodemailer` to `^9.0.3`                            | `@auth/core@0.38` depends on nodemailer; the only npm-computed fix is a major downgrade of `@auth/core`. Forcing nodemailer 9 transitively risks runtime API breakage in `@auth/core`. If incompatible, Execute falls back to accepting the nodemailer advisory as residual risk for this slice; a follow-up slice handles the `@auth/core`/nodemailer major bump with smoke tests. | n (deferred) |
| Verification gate                                       | `npm audit` exit 0 only (no test/build run)                  | User-selected. NOTE: Because we are not bumping any direct dep's major and changing only transitive pins + a non-breaking dev-dep bump, the application's runtime surface is statistically unchanged; the user has accepted this. The Execute Verifier MAY additionally run `npm run build` + `npm test` as a safety check but it is not a task-completion gate. | y          |
| Non-breaking direct dev-dep bumps                     | Allowed (`vitest` 3.1.1 → 3.2.6)                             | npm reports this fix as non-breaking. Keeping the direct dev-dep current reduces future audit noise without changing any major.        | y          |
| `@playwright/test` 1.51.1                               | Allow bump to latest 1.55.1 (non-major)                      | `playwright` advisory is high; npm reports a non-breaking fix. Patch-level bump on the direct dev dep is in keeping with the "no major on direct deps" rule. | y          |

**Open questions:** Two deferred to the Execute session (the `tar`/bcrypt and `nodemailer`/`@auth/core` overrides — both require empirical runtime validation, which is execution work, not planning). These are explicit risk admissions, not silent gaps.

**Known residual (acknowledged in spec):** It is possible that strict `npm audit` exit 0 is unreachable with overrides-only because `next`'s bundled PostCSS instance may carry its own `.package-lock`-pinned postcss that overrides cannot reach. If so, the Execute Verifier reports this as a SPEC_DEVIATION and the user re-scopes the slice (e.g., accept the postcss-moderate as documented residual in `STATE.md`). The planning posture is "attempt zero; if blocked by framework bundling, document and escalate, do not brute-force a next downgrade."

---

## User Stories

### P1: Zero-vulnerability audit via overrides ⭐ MVP

**User Story**: As a maintainer, I want `npm audit` to report zero vulnerabilities using only
`package.json` `overrides` and non-major dev-dep bumps, so that the supply chain is clean without
risking direct-dependency API breakage.

**Why P1**: This is the entire deliverable. The slice is vertical: a single change to `package.json`
(+ optional lockfile regeneration) that takes audit from 20 vulns to 0.

**Acceptance Criteria**:

1. WHEN `npm audit` is run on a fresh `npm ci` THEN it SHALL exit with code 0 and print "found 0
   vulnerabilities".
2. WHEN an engineer inspects `package.json` THEN every transitive pin SHALL be declared in a single
   `overrides` block (or `overrides` + the existing block), with a comment-free JSON key per pinned
   package (the rationale lives in this spec, not in JSON).
3. WHEN `npm ls <pinned-package>` is run for each overridden package THEN the resolved version SHALL
   match the override version at every occurrence in the dependency tree.
4. WHEN `npm ls bcrypt nodemailer @auth/core next` is run THEN each SHALL still resolve to its
   pre-slice direct version (`bcrypt@^5.1.1`, `nodemailer@^6.10.0`, `@auth/core@^0.38.0`,
   `next@16.2.10`) — i.e., no direct major was bumped.
5. WHEN the `package-lock.json` is regenerated (`npm install --package-lock-only`) THEN the lockfile
   SHALL contain the override-pinned versions and the install SHALL not emit ERESOLVE errors.
6. WHEN an override is empirically incompatible with its parent (runtime/build failure) THEN the
   Execute session SHALL either fall back to accepting that advisory as a documented residual in
   `STATE.md` OR escalate to a major bump of the named direct dep — either decision SHALL be logged
   as an `AD-NNN` decision in `STATE.md`, not silently made.

**Independent Test**: Checkout the branch, run `rm -rf node_modules package-lock.json && npm ci &&
npm audit`. Exit 0 = P1 passes. Re-run `npm ls bcrypt@5 nodemailer@6 @auth/core@0.38 next@16` to
confirm no direct majors moved.

---

### P2: Document residual risk in STATE.md

**User Story**: As a future maintainer, I want any vulnerability that could not be cleared via
overrides to be recorded as an `AD-NNN` entry in `.specs/STATE.md` with the rationale and the
recommended remediation path, so that the deferral is auditable.

**Why P2**: P2 is the escape hatch for the rare case where P1's overrides-only strategy hits a
hard incompatibility (most likely: `next`'s bundled postcss, or `@mapbox/node-pre-gyp`'s tar API
drift). Without P2, a deferred vuln becomes invisible.

**Acceptance Criteria**:

1. WHEN an overridden transitive cannot be made compatible THEN `STATE.md` SHALL gain an `AD-NNN`
   entry naming the package, the advisory IDs, the override attempt, the failure mode, and the
   recommended next-step (major bump vs. accept-as-residual).
2. WHEN P1 achieves literal exit 0 with no residual THEN P2 SHALL produce no `AD-NNN` entry (the
   "accept residual" branch is unused) AND this is a valid P2 completion state.

**Independent Test**: After P1, `grep -c "^### AD-" .specs/STATE.md`. Either 0 (clean) or each
present entry must name a real residual and its advisory IDs.

---

### P3: Regression smoke (optional, not a gate)

**User Story**: As a cautious maintainer, I want the Execute Verifier to optionally run
`npm run build` and `npm test` after the override change so any latent breakage surfaces — but this
is informational, not a gate.

**Why P3**: The user explicitly de-scoped tests from the gate. P3 codifies that the Verifier MAY
still run them and report findings, but task acceptance does not require their pass.

**Acceptance Criteria**:

1. WHEN the Execute Verifier runs THEN it MAY execute `npm run build` and `npm test` and report
   pass/fail in `validation.md`, but a failure in either SHALL NOT block task completion if
   `npm audit` exit 0 holds.
2. WHEN the Verifier finds a build/test failure THEN it SHALL record it in `validation.md` as a
   `POST_FIX_INFRA_BREAK` observation for a follow-up slice; it SHALL NOT attempt to fix application
   code in this slice.

---

## Edge Cases

- WHEN `npm` rejects an override with `ERESOLVE` because a parent pins an incompatible range THEN
  the Execute session SHALL try `npm install --package-lock-only --legacy-peer-deps` only as a
  last resort and shall record the flag in `STATE.md` if used; preference is to pick an override
  version that satisfies all parent ranges.
- WHEN two parents require mutually exclusive versions of a transitive (e.g. `vite` wants `rollup`
  4.x range, but an older dev tool wants 3.x) THEN the override SHALL pick the version that
  satisfies the production-critical parent; the resolution SHALL be reproduced by `npm ls rollup`
  showing a single resolved version with no `(deduped)` conflicts.
- WHEN `next@16` resolves its own bundled `postcss` independently of the override THEN the
  Execute session SHALL verify whether `npm audit` still flags postcss; if it does, the
  `STATE.md` residual path (P2) is triggered rather than pursuing a next downgrade.
- WHEN `npm ci` fails after lockfile regeneration due to `optionalDependencies`
  (`@esbuild/linux-x64`) THEN the Execute session SHALL NOT touch optionalDependencies in this
  slice; flag for a follow-up.
- WHEN an override version itself later becomes vulnerable THEN the `overrides` block is the
  single source of truth to bump — no scattered patches across the tree.

---

## Requirement Traceability

| Requirement ID | Story                | Phase  | Status  |
| -------------- | -------------------- | ------ | ------- |
| VULN-01        | P1: Zero-vuln audit | Tasks  | Pending |
| VULN-02        | P1: Overrides-only   | Tasks  | Pending |
| VULN-03        | P1: No direct major  | Tasks  | Pending |
| VULN-04        | P1: Lockfile clean   | Tasks  | Pending |
| VULN-05        | P1: Empirical fallback | Tasks | Pending |
| VULN-06        | P2: Residual record  | Tasks  | Pending |
| VULN-07        | P3: Optional smoke   | -      | Pending |

**ID format:** `VULN-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 7 total, 6 mapped to tasks, 1 unmapped (VULN-07 is informational, not a deliverable) ⚠️

---

## Success Criteria

- [ ] `npm audit` exits 0 on a clean `npm ci`.
- [ ] No direct dependency's resolved MAJOR version has changed from the pre-slice state for
  `bcrypt`, `nodemailer`, `@auth/core`, or `next`.
- [ ] A single `overrides` block in `package.json` is the documented source of truth.
- [ ] Any vuln that could not be cleared has an `AD-NNN` entry in `.specs/STATE.md` with advisory
  IDs and a remediation path.
- [ ] `package-lock.json` regenerates without `ERESOLVE` errors on stock `npm install`.