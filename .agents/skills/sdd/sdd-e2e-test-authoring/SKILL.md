---
name: sdd-e2e-test-authoring
description: Project-specific Playwright e2e test authoring for committed specs under e2e. Use when the user says "write e2e tests", "add a Playwright spec", "add e2e coverage for this feature", or an sdd-execute-jira task requires end-to-end tests. Do NOT use for screenshots, visual poking, temporary browser automation, or selector exploration; use playwright-skill for those. Do NOT use for unit, integration, or component tests.
license: CC-BY-4.0
metadata:
  author: Daniel Teleginski Camargo
  version: 1.0.0
---

# SDD E2E Test Authoring

Write Playwright end-to-end tests that are committed to the repository. This skill is project-specific: mirror the conventions in `e2e/`, protect sensitive-data boundaries, and keep tests stable enough for the SDD execution gate.

## Instructions

### Step 1: Confirm This Is The Right Skill

Use this skill when the work produces or updates committed Playwright specs under `e2e/`, especially from requests like "write e2e tests", "add a Playwright spec", "add e2e coverage for settings", or an `sdd-execute-jira` task that names e2e coverage.

Do not use this skill for temporary browser work. If the user wants to inspect a page, take screenshots, explore selectors, check responsiveness manually, or debug an interaction with a visible browser before deciding what to commit, use `playwright-skill` instead. If advanced Playwright API details are needed while writing a committed spec, read `.agents/skills/playwright-skill/API_REFERENCE.md` only for that topic and return here.

Expected output: one or more focused specs in `e2e/` plus any small shared helper changes needed to keep the suite maintainable.

### Step 2: Read The Local Test Shape First

Before writing a spec, read `playwright.config.ts`, `e2e/helpers/auth.ts`, and the closest existing spec for the feature area. If there is no close spec, read `e2e/home.spec.ts` for simple public-page style and `e2e/onboarding.spec.ts` for authenticated-flow style.

Keep these config facts in mind: tests live under `e2e/`; `baseURL` is `http://localhost:3000`; the Playwright web server starts `pnpm dev` locally and reuses an existing server outside CI; the normal command is `pnpm exec playwright test`.

Expected output: a short implementation approach that names the route, user state, helpers, and assertions before editing.

### Step 3: Place The Spec By User Flow

Create specs as `e2e/[area]/[flow].spec.ts` for nested product areas or `e2e/[flow].spec.ts` for broad top-level flows. Use `test.describe("[Flow name]", () => { ... })` and keep each file centered on one user-visible flow or page family.

Prefer adding to an existing nearby spec when the new case extends the same flow. Create a new file when the behavior has a distinct setup, route, or user goal.

Expected output: a small, discoverable spec file that future agents can scan quickly.

### Step 4: Use Safe Test Data

Never use real user data, real credentials, or anything that looks like production data. Generate synthetic users with `testEmail()` from `e2e/helpers/auth.ts`. Use obviously fake names and details such as "Test User", "Test Org", and "123 Main St".

Do not put sensitive data in logs, test titles, screenshots, fixtures, or assertions. Test names should describe behavior, not real entities.

Expected output: deterministic-looking test intent with fully synthetic data.

### Step 5: Reuse The Auth Helpers

For signup and magic-link flows, import from `e2e/helpers/auth.ts` instead of re-implementing auth setup. Use `registerUser(page, email)` for signup, `consumeMagicLink(page, email, request)` to follow the magic link, and `registerAndSetPassword(page, request, email, password)` when a password-mode login test needs an existing password user.

These helpers use `/api/test/magic-link`, `TEST_ENDPOINT_SECRET`, and the `x-test-secret` header. That route is only available when `PLAYWRIGHT=1` is set by `playwright.config.ts`, so do not call it from production code or non-e2e tests.

Expected output: auth setup remains centralized and consistent across specs.

### Step 6: Prefer Accessible Locators And Web-First Assertions

Use `page.getByRole`, `page.getByLabel`, and other user-facing locators first. Avoid CSS selectors, IDs, and test IDs unless the test is explicitly exercising native validation bypasses or there is no accessible selector available. For error messages, prefer role or text assertions that uniquely identify the visible message; Next's route announcer can also expose `role="alert"`, so avoid broad `page.getByRole("alert")` assertions when multiple alerts are possible.

Use `expect(...)` web-first assertions instead of manual sleeps. Do not use `waitForTimeout` for readiness. For asynchronous backend propagation, use `expect.poll` with intervals like `[200, 500, 1000]`. For redirect-heavy assertions, use explicit timeouts around 10 to 15 seconds.

After redirects, assert both location and rendered content. For example, check `await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })` and then check a heading that proves the page rendered.

Expected output: tests fail on user-visible regressions, not timing noise.

### Step 7: Cover The Behavior That Matters

For each user flow, choose focused cases from this checklist based on the feature risk: happy path, unauthenticated gate or redirect behavior, validation errors, persisted/resume state after reload, duplicate-submit or back-navigation behavior, and error messaging.

Do not create exhaustive UI click scripts. One strong happy path plus the riskiest edge cases is better than many brittle assertions.

Expected output: the spec protects the feature contract without becoming a maintenance burden.

### Step 8: Use Known Project Techniques Carefully

To exercise server-side validation when browser-native constraints would block submission, remove the native attribute in the test with a narrow locator, such as `await page.locator("#password").evaluate((el) => el.removeAttribute("minlength"))`. Add a short comment explaining why the bypass exists.

To simulate sign-out within a test, use `await page.context().clearCookies()` before navigating back to `/login`.

Expected output: special techniques are local, explained, and tied to a behavior the user would otherwise miss.

### Step 9: Validate The Change

Run the most focused Playwright command that covers the new or changed spec, then run the broader suite when helper code or shared auth behavior changed. Use `pnpm exec playwright test path/to/spec.ts` for a single spec and `pnpm exec playwright test` for the full suite.

If a test fails, inspect the failure and fix the spec or product code according to the task. Do not mask failures with longer timeouts unless there is a demonstrated async boundary.

Expected output: passing e2e evidence is included in the final response or task validation note.

## Examples

### Example 1: Authenticated Settings Flow

User says: "Add e2e coverage for the settings profile form."

Actions: read `playwright.config.ts`, `e2e/helpers/auth.ts`, and nearby settings or onboarding specs; create or update `e2e/settings/profile.spec.ts`; use `testEmail()` and `registerAndSetPassword()` to create a synthetic authenticated user; navigate to the settings route; assert the form heading renders; submit a valid fake profile update; assert the success `status` message; add one validation case if the form has meaningful server validation.

Result: a committed Playwright spec that reaches the page through real auth setup and asserts user-visible behavior with accessible locators.

### Example 2: Public Marketing Page

User says: "Write a Playwright spec for the pricing page."

Actions: read `playwright.config.ts` and `e2e/home.spec.ts`; create `e2e/pricing.spec.ts`; navigate with `await page.goto("/pricing")`; assert the main heading, primary call-to-action link target, and page title; avoid auth helpers because the page is public.

Result: a small public-page spec mirroring the homepage pattern.

### Example 3: Selector Exploration Before Authoring

User says: "Figure out why the signup button is not clickable, then write the e2e test."

Actions: use `playwright-skill` first for temporary visible-browser exploration and selector debugging; once the behavior and stable locators are known, return to this skill to write the committed `e2e/` spec.

Result: exploration artifacts stay in `/tmp`, while the repository only receives the durable spec.

## Troubleshooting

### Error: Magic link endpoint returns 404 repeatedly

Cause: the signup action may not have persisted the link yet, or the wrong email was used. Solution: use `consumeMagicLink()` from `e2e/helpers/auth.ts`, which already polls the endpoint with the correct secret header.

### Error: Browser native validation prevents the expected field error

Cause: required, minlength, or similar attributes can stop the submit before the server action runs. Solution: remove only the relevant native attribute in the test and comment that the bypass exists to exercise server-side validation.

### Error: Test passes URL assertion but page content is blank or wrong

Cause: redirect completed before the page finished rendering the expected state. Solution: assert a stable rendered heading, status, alert, or link after `toHaveURL`.

### Error: The request is only for screenshots or manual inspection

Cause: this is not committed e2e authoring. Solution: use `playwright-skill`, which writes temporary scripts under `/tmp` and runs a visible browser.
