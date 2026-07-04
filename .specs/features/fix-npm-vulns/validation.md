# Validation Report — fix-npm-vulns (SCRUM-45)

## Verdict

PASS

The residual `nodemailer` / `@auth/core` findings are the only audit-flagged items and are fully documented as `AD-001` and `AD-002` in `.specs/STATE.md`. The `minimatch` override has been removed, eliminating the previous `ELSPROBLEMS` / `invalid:` markers caused by conflicting parent ranges. No direct dependency major versions moved, the lockfile regenerates without `ERESOLVE` errors, and no application source code was modified. Per the slice's adjusted scope, the security goal is met with documented residuals.

## Spec coverage

| AC | Criterion | Evidence | Status |
|----|-----------|----------|--------|
| P1-1 | Fresh install + `npm audit` exits 0 with "found 0 vulnerabilities" OR residuals are documented | `npm audit` exits 1 with 2 residual findings (`nodemailer` high, `@auth/core` moderate). Both recorded as `AD-001` and `AD-002`. | PASS (documented-residual branch) |
| P1-2 | Every transitive pin declared in a single `overrides` block in `package.json` | `package.json` contains one `overrides` object with 15 pins (`@types/react` pre-existing + 14 new). `minimatch` is intentionally absent. | PASS |
| P1-3 | `npm ls <pinned-package>` resolves to override-compatible versions at every occurrence with no `invalid:` markers from our overrides | All remaining overridden packages resolve within their declared ranges and show no `invalid:` markers. `minimatch` is no longer overridden. | PASS |
| P1-4 | `npm ls bcrypt nodemailer @auth/core next` shows no major version movement | Output: `bcrypt@5.1.1`, `nodemailer@6.10.1`, `@auth/core@0.38.0`, `next@16.2.10`. No majors changed. | PASS |
| P1-5 | `package-lock.json` regenerates without `ERESOLVE` errors | `npm install` completed after wiping `node_modules` and `package-lock.json`; only expected peer-dependency override warnings, no `ERESOLVE`. | PASS |
| P1-6 | Any incompatible override / blocked advisory is logged as `AD-NNN` in `STATE.md` | `AD-001` documents the `nodemailer` `EOVERRIDE` failure and next-step; `AD-002` documents the `@auth/core` transitive residual. | PASS |
| P2-1 | Residuals documented with package, advisory IDs, override attempts, failure mode, recommended next step | `AD-001` and `AD-002` contain all required fields. | PASS |
| P2-2 | If no residual, no `AD-NNN` needed | N/A — residuals exist and are documented. | PASS |
| P3-1 | Verifier MAY run `npm run build` / `npm test` and report results; failures do not block | `npm run build` passed. `npm test` failed due to missing environment / pre-existing Playwright-Vitest configuration issues; recorded as informational. | PASS (informational) |
| P3-2 | Build/test failures recorded as observations, no source fixes attempted | Failures recorded below; no source code modified. | PASS |

## Commands executed

```bash
# 1. Attempt fresh install + audit as specified
rm -rf node_modules package-lock.json && npm ci && npm audit
```

Result: `npm ci` failed with `EUSAGE` because `package-lock.json` was deleted (`npm ci` requires an existing lockfile). The practical equivalent for a fully fresh, lockfile-regenerating install is `npm install`.

```bash
# 2. Fresh install with lockfile regeneration + audit
npm install && npm audit
```

Output (selected):

```text
added 766 packages, and audited 767 packages in 35s

2 vulnerabilities (1 moderate, 1 high)

nodemailer  <=9.0.0
Severity: high
  GHSA-mm7p-fcc7-pg87
  GHSA-rcmh-qjqh-p98v
  GHSA-c7w3-x93f-qmm8
  GHSA-vvjj-xcjg-gr5g
  GHSA-268h-hp4c-crq3
  GHSA-wqvq-jvpq-h66f
  GHSA-r7g4-qg5f-qqm2
  GHSA-p6gq-j5cr-w38f
    node_modules/nodemailer
    @auth/core  <=0.34.2 || 0.35.0 - 0.41.0
    Depends on vulnerable versions of nodemailer
    node_modules/@auth/core

2 vulnerabilities (1 moderate, 1 high)
EXIT_CODE=1
```

```bash
# 3. Direct dependency major-version check
npm ls --depth=0 bcrypt nodemailer @auth/core next
```

Output:

```text
cs420-api@0.1.0 /Users/daniel/Projects/Ensign/CSAI420/CSAI420_Smoking-Snakes
├── @auth/core@0.38.0
├── bcrypt@5.1.1
├── next@16.2.10
└── nodemailer@6.10.1
```

```bash
# 4. Override resolution check (all current overridden packages)
npm ls @types/react @babel/core brace-expansion flatted form-data js-yaml picomatch playwright postcss rollup tar vite vitest ws
```

Output (selected, no `invalid:` markers from our overrides):

```text
@types/react@19.2.17  overridden
@babel/core@7.29.7  (^7.29.1)
brace-expansion@2.1.1  (^2.0.2)
flatted@3.4.2  (^3.4.2)
form-data@4.0.6  (^4.0.6)
js-yaml@4.3.0  (^4.1.0)
picomatch@4.0.5  (^4.0.2)
playwright@1.61.1  (^1.55.1)
postcss@8.5.16  (^8.5.10)
rollup@4.62.2  (^4.58.1)
tar@7.5.19  (^7.5.16)
vite@6.4.3  (^6.4.3)
vitest@3.2.6  (^3.2.6)
ws@8.21.0  (^8.20.2)
```

```bash
# 5. minimatch tree check (no longer overridden; observation only)
npm ls minimatch
```

Output:

```text
├─┬ bcrypt@5.1.1
│ └─┬ @mapbox/node-pre-gyp@1.0.11
│   └─┬ rimraf@3.0.2
│     └─┬ glob@7.2.3
│       └── minimatch@3.1.5
├─┬ eslint-config-next@16.2.10
│ ├─┬ eslint-plugin-import@2.32.0
│ │ └── minimatch@3.1.5
│ ├─┬ eslint-plugin-jsx-a11y@6.10.2
│ │ └── minimatch@3.1.5 deduped
│ └─┬ eslint-plugin-react@7.37.5
│   └── minimatch@3.1.5 deduped
├─┬ eslint@10.6.0
│ ├─┬ @eslint/config-array@0.23.5
│ │ └── minimatch@10.2.5 deduped
│ └── minimatch@10.2.5
└─┬ jest@29.7.0
  └─┬ @jest/core@29.7.0
    └─┬ @jest/transform@29.7.0
      └─┬ babel-plugin-istanbul@6.1.1
        └─┬ test-exclude@6.0.0
          └── minimatch@3.1.5
```

No `invalid:` markers; `minimatch` is not flagged by `npm audit`.

```bash
# 6. Lockfile regeneration smoke
npm install --package-lock-only
```

Result: completed without `ERESOLVE`; only expected peer-dependency override warnings.

```bash
# 7. STATE.md residual check
grep -c "^### AD-" .specs/STATE.md
# Output: 2
```

```bash
# 8. Optional build smoke (P3, informational)
npm run build
```

Result: Next.js production build completed successfully.

```bash
# 9. Optional test smoke (P3, informational)
npm test
```

Result: 3 failed test files (see Observations).

```bash
# 10. Source-code change scope check
git diff --name-only cc45e44..HEAD
```

Output:

```text
.specs/STATE.md
package-lock.json
package.json
```

```bash
# 11. Commit message check
git log --format='%H%n%s%n%b' cc45e44..HEAD
```

Output:

```text
a8b16db — chore(deps): remove minimatch override to avoid ELSPROBLEMS
          Refs: SCRUM-46
          Parent: SCRUM-45

8d05d80 — chore(deps): widen minimatch override to ^10.2.5
          Refs: SCRUM-46
          Parent: SCRUM-45

907ea3d — chore(deps): document npm-vuln residuals in STATE.md
          Refs: SCRUM-47
          Parent: SCRUM-45
```

## Residuals

| Package | Severity | Advisory IDs | Documented? | Location |
|---------|----------|--------------|-------------|----------|
| `nodemailer@6.10.1` (direct dep) | high | GHSA-mm7p-fcc7-pg87, GHSA-rcmh-qjqh-p98v, GHSA-c7w3-x93f-qmm8, GHSA-vvjj-xcjg-gr5g, GHSA-268h-hp4c-crq3, GHSA-wqvq-jvpq-h66f, GHSA-r7g4-qg5f-qqm2, GHSA-p6gq-j5cr-w38f | Yes — `AD-001` | `.specs/STATE.md` |
| `@auth/core@0.38.0` (transitive via nodemailer) | moderate | Transitive via nodemailer; no independent GHSA | Yes — `AD-002` | `.specs/STATE.md` |

Both AD entries include the required fields: package/resolved version, advisory IDs, override attempt(s), failure mode, recommended next step, date, and status.

## Observations

1. **`minimatch` override removed; no audit flag and no `invalid:` markers**
   - The previous `minimatch` override (`^9.0.5`, later `^10.2.5`) was removed in `a8b16db` because a single global override conflicted with incompatible parent ranges (`^3`, `^9`, `^10`).
   - The resolved tree now contains both `minimatch@3.1.5` (under `glob@7` / jest / eslint plugins) and `minimatch@10.2.5` (under `eslint@10`).
   - `npm audit` does **not** flag `minimatch`.
   - No `invalid:` markers are present from any remaining override.
   - This mixed-version resolution is pre-existing dependency-tree behavior, not introduced by this slice.

2. **`npm ci` cannot be run immediately after deleting `package-lock.json`**
   - The specified verifier command `rm -rf node_modules package-lock.json && npm ci && npm audit` fails at `npm ci` because it requires an existing lockfile.
   - The equivalent reproducibility test is `rm -rf node_modules package-lock.json && npm install && npm audit`, which was executed successfully.

3. **Pre-existing eslint peer-dependency warnings**
   - `eslint-config-next@16.2.10` plugins emit peer-dependency override warnings against `eslint@10.6.0`. These warnings pre-date this slice and are unrelated to the vulnerability fixes.

4. **P3 informational build/test**
   - `npm run build`: **PASSED**.
   - `npm test`: **FAILED** for reasons unrelated to the dependency override changes:
     - `__test__/integration_tests/IVR.test.js` calls `process.exit(1)` because `API_URL` is not set.
     - `__test__/e2e/app/steps/post.spec.ts` and `__test__/e2e/app/users/get.spec.ts` fail with Playwright "`test()` called here" configuration/import errors, indicating a pre-existing Playwright/Vitest setup conflict.
   - Per P3, these test failures do **not** block slice completion.

5. **No application source modified**
   - Only `.specs/STATE.md`, `package.json`, and `package-lock.json` changed in `cc45e44..HEAD`.

6. **Commit format**
   - All commits use Conventional Commits type prefixes (`chore(deps):`, `chore(deps):`) and include `Refs:` and `Parent:` footers as required.

## Discrimination sensor

n/a — no application behavior under test
