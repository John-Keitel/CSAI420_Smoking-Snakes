# ADR-001: Expo Mobile Client Colocated in the API Repository

- **Date**: 2026-08-02
- **Status**: Accepted
- **Deciders**: @asf0 — engineering
- **Tags**: architecture, mobile, repository-layout, tooling

## Context and Problem Statement

EPIC 12 (SCRUM-140, "React Native In-App Chat UI & Accessibility") requires a React Native client,
but no such client exists anywhere in the project. This repository is `cs420-api`, a Next.js API
backend; the two sibling Expo projects in the workspace (`cs420-rn1-code-challenge-asf0`,
`cs420-rn2-code-challenge-asf0`) are GitHub Classroom code challenges, not the product's mobile app.

EPIC 12 therefore cannot start until we decide where its code lives. The decision is forced by the
delivery process as much as by the code: `.opencode/rules/spec-driven-flow.md` mandates that every
slice carry `.specs/features/<slice>/` artifacts, that task issues link to a parent Jira epic, and
that `sdd-execute-jira` fan out work into git worktrees forked from a slice branch — all of which
are anchored to a single repository and a single GitHub remote.

## Decision Drivers

- Spec-driven traceability must remain intact: spec → Jira task → branch → atomic commit → PR review.
- `sdd-execute-jira` forks worktrees from this repo; `sdd-pr-review` runs against a PR on this repo's
  remote (`John-Keitel/CSAI420_Smoking-Snakes`).
- The mobile client's only backend is this repo's API; contract drift between the two should be
  visible in one diff.
- The API's CI gates (`npm run format`, `lint`, `typecheck`, `test:unit`, `build`) must not regress.
- This is coursework with a single developer — operational overhead of a second repo is real cost
  with no offsetting benefit.

## Considered Options

- **Colocated `mobile/`**: Expo app as a sibling directory inside this repository, with its own
  `package.json` and Jest config, fenced off from the API toolchain.
- **Separate repository**: a standalone `cs420-mobile` repo, mirroring how rn1/rn2 are laid out.
- **Next.js web UI instead**: build the chat as React web components in the existing `src/app/` tree
  and drop React Native entirely.

## Decision Outcome

Chosen option: **"Colocated `mobile/`"**, because it is the only option that keeps the spec-driven
automation chain working end to end. A separate repository would split `.specs/` artifacts from the
code they specify and would require a second remote before `sdd-pr-review` could run at all. A web
UI would contradict the epic and silently drop the two native-specific tasks in scope (SCRUM-93
keyboard avoidance, SCRUM-94 dynamic font scaling).

Concrete rules that follow from this decision:

1. The Expo app lives at `mobile/`, with its own `package.json`, `jest.config.js`, and lockfile. It
   is **not** an npm workspace of the root package — the root remains a single-purpose Next.js app.
2. Baseline is **Expo SDK 54 / React Native 0.81 / React 19**, matching `cs420-rn1-code-challenge-asf0`
   (the newer of the two reference projects).
3. Tests use **`@testing-library/react-native` 13** with the `jest-expo` preset. This deliberately
   departs from rn1's `react-test-renderer` workaround (documented in its
   `ExpoTestingAlternatives.md`): RNTL 13 supports React 19, rn2 already uses RNTL, and asserting on
   a scrolling list and keyboard behavior is impractical with `react-test-renderer`.
4. The API base URL is read from `Constants.expoConfig.extra.apiBaseUrl` via `expo-constants`. This
   extends rn2's existing use of `expo-constants` for EAS config rather than inventing a new
   convention, and replaces the hardcoded `https://dev.stedi.me` literals used in rn1/rn2.
5. `mobile/` must be fenced from every root toolchain entry point. At minimum: `tsconfig.json`
   `exclude`, `.prettierignore`, `eslint.config.mjs` `ignores`, and `.dockerignore`. This is not
   optional — `tsconfig.json` currently includes `**/*.ts`/`**/*.tsx` and excludes only
   `node_modules`, and CI runs `prettier --check .`, so an unfenced `mobile/` breaks
   `npm run typecheck` and the CI format gate.

### Positive Consequences

- One repository, one Jira project, one PR per slice — the SDD chain works unmodified.
- Client and server contract changes appear in the same diff and the same review.
- No second GitHub remote, CI setup, or secret store to maintain.

### Negative Consequences

- The repository is no longer single-purpose; `cs420-api` now hosts two applications with different
  runtimes and dependency trees.
- Root toolchain configs accumulate `mobile/` exclusions, which is easy to forget when adding a new
  tool later. Mitigated by a CI job that runs the mobile suite independently.
- Two lockfiles and two `node_modules` trees; `npm audit` at the root does not cover `mobile/`.
- If the mobile client later needs its own release cadence or a different team, extracting it into
  its own repository becomes a migration rather than a no-op.

## Pros and Cons of the Options

### Colocated `mobile/` ✅ Chosen

- ✅ Preserves `sdd-execute-jira` worktrees and `sdd-pr-review` against a real PR
- ✅ `.specs/` artifacts sit beside the code they specify
- ✅ Client/server contract drift is visible in one diff
- ❌ Repo is no longer single-purpose; toolchain fencing becomes a standing maintenance obligation
- ❌ Root `npm audit --omit=dev` does not see mobile dependencies

### Separate repository

- ✅ Clean separation of runtimes, dependencies, and release cadence
- ✅ Zero risk to the API build
- ❌ Splits spec from implementation across two repos, breaking traceability
- ❌ Requires a second remote and CI before the PR review gate can run

### Next.js web UI instead

- ✅ Fastest path; reuses the existing toolchain and shadcn MCP; no CORS concern
- ❌ Contradicts EPIC 12 and every task summary under it
- ❌ SCRUM-93 (keyboard-avoiding view) and SCRUM-94 (dynamic font scaling) are native concerns with
  no faithful web equivalent

## Links

- Epic: [SCRUM-140](https://csai420.atlassian.net/browse/SCRUM-140) — EPIC 12: React Native In-App
  Chat UI & Accessibility
- TDD: [2026-08-onboarding-chat-mobile-client](../tdd/2026-08-onboarding-chat-mobile-client.md)
- Slice: `.specs/features/onboarding-chat-ui/`
- Consumes: `src/app/chat/continue-session/route.ts`, `src/app/user/chat-assisted/route.ts`
- Implementation: `mobile/` (created by the slice's T1)
