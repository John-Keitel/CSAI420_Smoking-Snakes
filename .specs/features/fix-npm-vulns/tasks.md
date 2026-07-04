# Fix npm Vulnerabilities Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

> **Repo override:** Execution is owned by the `sdd-execute-gh` session, NOT this planning session. This `tasks.md` is the handoff contract for that session. Do not run Execute here.

---

**Design**: none — Discarded (no architectural decisions; supply-chain slice).
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute. Guidelines found: `AGENTS.md`, `.specs/codebase/CONVENTIONS.md` — neither defines a coverage gate for supply-chain changes; strong defaults applied below.

| Code Layer                            | Required Test Type | Coverage Expectation                                         | Location Pattern       | Run Command                  |
| ------------------------------------- | ------------------- | ------------------------------------------------------------ | ---------------------- | ---------------------------- |
| `package.json` `overrides` block      | none                | — gate is `npm audit` exit 0 (per spec VULN-01)              | `package.json`         | `npm audit` (expect exit 0)  |
| `package-lock.json` regeneration      | none                | — gate is clean `npm install --package-lock-only` w/o ERESOLVE | `package-lock.json`    | `npm install --package-lock-only` |
| Direct dev-dep bumps (`vitest`, `@playwright/test`) | none     | — non-major bumps; gate is `npm audit` + (optional) `npm run build` | `package.json`        | `npm audit`                  |
| `.specs/STATE.md` residual record      | none                | — informational; gate is presence of `AD-NNN` only if residual | `.specs/STATE.md`     | manual grep                  |

**Rationale:** This slice changes no application source code, exports no runtime API, and modifies no business logic. The spec's verification gate (VULN-01 / Success Criteria) is explicitly `npm audit` exit 0, NOT a unit/integration/e2e suite. The Verifier MAY run `npm run build` + `npm test` as an informational safety check (P3), but these are not task-completion gates and may not block task closure.

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type   | Parallel-Safe? | Isolation Model                                | Evidence                                          |
| ----------- | -------------- | ---------------------------------------------- | ------------------------------------------------- |
| n/a (no tests) | n/a         | Single `package.json` is a shared mutable file | Both tasks edit `package.json` — MUST be sequential |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use                                       | Command                                              |
| ---------- | ------------------------------------------------- | ---------------------------------------------------- |
| Audit      | After every task in this slice                    | `npm audit` (expect: 0 vulnerabilities, exit 0)     |
| Lockfile   | After any `package.json` change                   | `npm install --package-lock-only` (no ERESOLVE)      |
| Residual   | Only if T2 determines a vuln cannot be cleared    | `grep -c "^### AD-" .specs/STATE.md` (manual check)  |
| Optional info | Verifier only, not a task gate                | `npm run build` + `npm test` (results recorded in validation.md; failures do NOT block closure) |

---

## Execution Plan

### Phase 1: Sequential (single shared file — `package.json`)

```
T1 ──→ T2
```

T1 establishes the override block and non-major dev-dep bumps.
T2 resolves any residual that T1 could not clear via overrides and records it.

**No parallel phase.** Both tasks mutate `package.json` and `package-lock.json` — they must serialize to avoid clobbering overwrite conflicts.

---

## Task Breakdown

### T1: Add overrides + non-major dev-dep bumps; regenerate lockfile; verify audit clean

**Issue**: https://csai420.atlassian.net/browse/SCRUM-46

**What**: Add a single `overrides` block to `package.json` pinning every flagged transitive dep to a patched version, bump `vitest` to `^3.2.6` and `@playwright/test` to `^1.55.1`, regenerate `package-lock.json`, and confirm `npm audit` exits 0 with zero vulnerabilities.

**Where**: `package.json`, `package-lock.json`

**Depends on**: None

**Reuses**: Existing `package.json` `overrides` field (currently `{"@types/react": "19.2.17"}`) — extend, do not replace.

**Requirement**: VULN-01, VULN-02, VULN-03, VULN-04

**Tools**:
- MCP: NONE (no library docs needed; npm's own resolver computes the fixed versions)
- Skill: NONE

**Override targets** (initial set — Execute may iterate versions):

| Package                 | Override version (initial)      | Reason                                            |
| ----------------------- | ------------------------------- | ------------------------------------------------ |
| `@babel/core`           | `^7.29.1`                       | Direct advisory GHSA-4x5r-pxfx-6jf8 (low)        |
| `brace-expansion`       | `^1.1.13` or `^2.0.2`           | Multiple ReDoS advisories                        |
| `flatted`               | `^3.4.2`                        | Recursive DoS + prototype pollution (high)       |
| `form-data`             | `^4.0.6`                        | Boundary + CRLF injection (critical)             |
| `js-yaml`               | `^3.14.3` or `^4.1.0`           | Prototype pollution + DoS (moderate, transitive under nyc) |
| `minimatch`             | `^3.1.4` or `^9.0.5`            | Multiple ReDoS advisories (high)                  |
| `nodemailer`            | `^9.0.3`                        | Forces patched nodemailer transitively under `@auth/core` — RISK: may break `@auth/core@0.38`'s expectations; T2 catches incompatible cases |
| `picomatch`             | `^2.3.2` or `^4.0.2`            | Method injection + ReDoS (high)                   |
| `playwright`            | `^1.55.1`                        | SSL cert validation (high)                       |
| `postcss`               | `^8.5.10`                       | User-selected; downgrades next are explicitly rejected (moderate) |
| `rollup`                | `^4.58.1` or `^4.70.0`          | Arbitrary file write via path traversal (high)   |
| `tar`                   | `^7.5.16`                        | RISK: `@mapbox/node-pre-gyp` may be incompatible; T2 catches via `npm ci` smoke |
| `vite`                  | `^6.4.3` or `^7.1.5`            | Multiple dev-server path traversal (high)        |
| `vitest`                | `^3.2.6` (direct dev-dep bump)  | Arbitrary file read/exec in UI server (critical) |
| `ws`                    | `^8.20.2`                       | Memory disclosure + DoS (high)                    |
| `@playwright/test` (direct dev-dep bump to `^1.55.1`) | —                | Non-major bump — permitted                       |

**Strategy**:
1. Edit `package.json`:
   - Extend `overrides` with the pins above.
   - Bump `vitest` devDep to `^3.2.6`.
   - Bump `@playwright/test` devDep to `^1.55.1`.
2. Run `npm install --package-lock-only`.
   - If `ERESOLVE` → adjust the offending override version (pick a version inside the parent's allowed range) and retry. Do NOT use `--legacy-peer-deps` as a first resort; flag and document if used.
3. Wipe and reinstall: `rm -rf node_modules && npm ci`.
4. Run `npm audit`.
   - Exit 0 → T1 Done, move to commit.
   - Non-zero exit → identify residual packages; feed into T2.

**Done when**:
- [ ] `package.json` `overrides` block contains pins for every flagged transitive from the spec table.
- [ ] `vitest` devDep shows `^3.2.6` (or higher within major 3) in `package.json`.
- [ ] `@playwright/test` devDep shows `^1.55.1` (or higher within major 1) in `package.json`.
- [ ] `npm install --package-lock-only` completes with no `ERESOLVE` errors.
- [ ] `npm ci` after wiping `node_modules` succeeds.
- [ ] `npm audit` exits 0 and prints "found 0 vulnerabilities" — OR — non-zero exits documented in T2 input.
- [ ] `npm ls bcrypt nodemailer @auth/core next` shows no major-version movement on these four direct deps (bcrypt@5.x, nodemailer@6.x, @auth/core@0.38.x, next@16.x).
- [ ] Lint not required for this task (no source files changed).

**Tests**: none (per coverage matrix — gate is `npm audit` exit 0)
**Gate**: audit + lockfile regen

**Commit**: `chore(deps): pin vulnerable transitives via overrides + bump vitest/playwright dev deps`

---

### T2: Resolve or document residuals; update STATE.md

**Issue**: https://csai420.atlassian.net/browse/SCRUM-47

**What**: For any vulnerability T1 could not clear via overrides (most likely candidates: `postcss` under next's bundled pipeline, `nodemailer` forcing `@auth/core` incompatibility, `tar` forcing `@mapbox/node-pre-gyp` incompatibility), either (a) iterate the override version until audit is clean, OR (b) record the residual as an `AD-NNN` entry in `.specs/STATE.md` naming the package, advisory IDs, override attempt, failure mode, and the recommended remediation (major bump vs. accept-as-residual). Update the Handoff section of `STATE.md` with the slice outcome.

**Where**: `package.json` (only if iterating overrides), `.specs/STATE.md`

**Depends on**: T1

**Reuses**: T1's override block as the starting point

**Requirement**: VULN-05, VULN-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Decision flow per residual**:

For each package where T1's override did not clear the audit:

1. **Re-attempt**: pick the next-higher patched version still inside the parent's allowed range; rerun `npm audit`. Repeat up to 3 versions.
2. **Incompatibility check**: run `npm ci` + (optionally) `npm run build`. If either breaks AND the break is attributable to the override, that override is incompatible.
3. **Incompatible → residual record**: append `### AD-NNN` entry to `.specs/STATE.md` `## Decisions` section with:
   - Package name and resolved version after override attempt
   - Advisory IDs (GHSA-* URLs)
   - Override version(s) tried
   - Failure mode (e.g., `ERESOLVE`, `npm ci` failure, `npm run build` failure with stacktrace summary)
   - Recommended next step: "bump `bcrypt` to `^6.0.0` in a follow-up slice" or "accept as runtime-confined residual — package is dev-only / not reachable from prod code path"
   - Date, Status: `active`
4. **Compatible but audit still flags** (e.g., next's bundled postcss): record residual with rationale that override cannot reach the bundled instance; recommend following upstream next patch release.

**STATE.md Handoff update** (always written, even if T1 already clean):

```markdown
- **Feature**: fix-npm-vulns / .specs/features/fix-npm-vulns/
- **Phase / Task**: Tasks T2 — RESOLVE RESIDUALS
- **Completed**: T1, T2
- **In-progress**: (none)
- **Next step**: Awaiting Execute-session Verifier; or (if residual recorded) opening follow-up slice for `<package>` major bump.
- **Blockers**: [list residual packages here or "none — audit exits 0"]
- **Uncommitted files**: none
- **Branch**: (set by sdd-execute-gh)
```

**Done when**:
- [ ] `npm audit` exits 0 — OR — every residual that could not be cleared has an `AD-NNN` entry in `.specs/STATE.md` with: package, advisory IDs, override attempts, failure mode, recommended next step.
- [ ] No application source code (`src/**`, `app/**`, `prisma/**`, `__test__/**`) was modified in either task.
- [ ] `.specs/STATE.md` Handoff section reflects final slice state.
- [ ] If a residual `AD-NNN` was written, the recommended-next-step names a concrete follow-up action (not "investigate later").

**Tests**: none
**Gate**: audit + residual grep

**Commit**: `chore(deps): document npm-vuln residuals in STATE.md`

If T1 already achieved audit exit 0 and no residuals need recording, T2 still runs and its sole output is the `STATE.md` Handoff update. Commit message in that case: `docs(state): record fix-npm-vulns completion in handoff`.

---

## Parallel Execution Map

```
Phase 1 (Sequential — shared file `package.json`):
  T1 ──→ T2
```

**No parallel phase.** The parallelism assessment forbids `[P]` here: a single `package.json` is the shared mutable state for both tasks.

**Phase count: 1** (≤3 phases) → execution is inline; no sub-agent dispatch offer from `sdd-execute-gh`.

---

## Task Granularity Check

| Task                                         | Scope                                           | Status       |
| -------------------------------------------- | ----------------------------------------------- | ------------ |
| T1: Add overrides + dev bumps + lockfile     | 1 `package.json` edit + 1 lockfile regen        | ✅ Granular  |
| T2: Resolve residuals + STATE.md             | 1 `STATE.md` edit (+ optional `package.json` iter) | ✅ Granular  |

Both tasks are one-file primary edits; T2's iteration is bounded and cohesive. No split needed.

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows       | Status     |
| ---- | ---------------------- | -------------------- | ---------- |
| T1   | (none)                 | start of chain       | ✅ Match   |
| T2   | T1                     | arrow T1 → T2        | ✅ Match   |

No `[P]` flags to validate. No inter-phase dependencies.

---

## Test Co-location Validation

| Task         | Code Layer Created/Modified                          | Matrix Requires | Task Says            | Status    |
| ------------ | ---------------------------------------------------- | --------------- | -------------------- | --------- |
| T1: overrides | `package.json` overrides + lockfile                 | none            | `Tests: none`        | ✅ OK     |
| T1: dev bumps | `vitest`, `@playwright/test` direct versions         | none            | `Tests: none`        | ✅ OK     |
| T2: residual  | `.specs/STATE.md` (documentation, not code)          | none            | `Tests: none`        | ✅ OK     |

All "none" entries are backed by the coverage matrix's stated reasoning (supply-chain slice; the spec's gate is `npm audit` exit 0, not a test suite). The optional `npm run build`/`npm test` run by the Verifier is informational and lives in `validation.md`, not in any task's "Tests" field.

---

## Tips applied

- **Dependencies are gates** — T1 must complete (and commit) before T2 starts; both mutate `package.json`.
- **Done when = Testable** — each `Done when` entry references a binary command (`npm audit` exit code, `grep` match, `npm ci` success).
- **Requirement ID = Traceable** — T1 covers VULN-01..04; T2 covers VULN-05..06; VULN-07 is informational and has no task (intentional, per spec).
- **One commit per task** — commit messages pre-specified above.

---

## Task Verification Standards

Each `Done when` entry in T1 and T2 is binary-pass/fail and references a Gate Check Command from the table above. Execute Verifier re-derives coverage independently per the spec-anchored outcome check; since this slice's gate is `npm audit` exit 0 (per spec VULN-01), the Verifier's outcome check asserts: "fresh `npm ci` then `npm audit` exits 0 with 'found 0 vulnerabilities' on stdout." The Verifier's discrimination sensor has limited applicability here (no behavior-level mutants in a supply-chain slice); per `validate.md`, the sensor reports "n/a — no application behavior under test" in that case rather than skipping silently.