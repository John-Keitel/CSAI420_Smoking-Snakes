# Better Auth STEDI Login Migration Specification

## Problem Statement

The current project splits authentication into two incompatible flows: browser-visible STEDI token issuance through `/login`, and app-owned bearer JWT sessions through `/auth/signin`. The requested login experience needs an App Router page and server action, which means the browser flow must move to cookie-backed sessions while still preserving STEDI-authenticated downstream requests.

## Goals

- [ ] Users can sign in from `/login` with a server action using `username` and `password`, then land on `/dashboard` on success.
- [ ] Authenticated browser requests can reach STEDI-backed routes without manually sending `suresteps.session.token` from the client.
- [ ] Existing app-owned auth endpoints and tests migrate away from the current custom JWT + `/login` pass-through split.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
| ------- | ------ |
| STEDI two-factor login endpoints | The request is for username/password login only. |
| Full dashboard implementation | Only a minimal post-login landing page is required. |
| Signup UX redesign | The current signup flow is not part of this login migration. |
| Preserving the legacy `POST /login` API contract | The user chose to replace the route with the page/action flow. |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here — nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Browser auth state | Better Auth manages the browser session cookie, and the STEDI token is stored server-side against that session | Avoids exposing the legacy STEDI token to the browser while still satisfying downstream header requirements | y |
| Success destination | Redirect successful logins to `/dashboard` | User explicitly requested `/dashboard` as the landing route | y |
| `/login` surface | Replace the legacy route handler with `page.tsx`, `login.tsx`, and `actions.ts` under the login route segment | Matches the requested App Router/server-action split | y |
| Dashboard auth boundary | Treat `/dashboard` as a protected page that redirects unauthenticated users to `/login` | The page exists only as a post-login landing target and should not become a second anonymous entry point | n |
| Login identifier | The form labels the identifier as `username` and the server sends it to STEDI as `userName` with `password` | The user explicitly asked for a username/password STEDI login request | y |
| `/auth/signup` behavior | Keep signup behavior functionally unchanged unless Better Auth wiring requires small supporting changes | Signup redesign was not requested, but auth infrastructure changes may touch shared setup | n |
| `/auth/signin` response shape | Migrate `/auth/signin` to Better Auth-backed session semantics even if that breaks the current bearer-token response contract | The user asked to replace the current `/auth/signin` flow with Better Auth, and existing callers/tests can be updated in the same feature | n |

**Open questions:** none — all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P1: Browser Login With Server Actions ⭐ MVP

**User Story**: As a returning user, I want to sign in from a real login page so that I can authenticate without manually handling legacy STEDI tokens.

**Why P1**: This is the core user-facing requirement and the reason for replacing the current route-only login surface.

**Acceptance Criteria**:

1. WHEN an unauthenticated user navigates to `/login` THEN the system SHALL render a login page with `username` and `password` inputs, a submit action, and pending/error UI driven by a server action.
2. WHEN a user submits valid credentials THEN the system SHALL authenticate against STEDI server-side, establish a Better Auth session, associate the returned STEDI token with that session server-side, and redirect the user to `/dashboard`.
3. WHEN a user submits invalid credentials or invalid form data THEN the system SHALL keep the user on `/login` and display actionable errors without exposing secrets or raw upstream responses.
4. WHEN the STEDI login request times out or the upstream service is unavailable THEN the system SHALL not create a session and SHALL return a recoverable login error state on `/login`.

**Independent Test**: Visit `/login`, submit valid and invalid credentials, and verify redirect, pending, and error states without using manual header/token setup.

---

### P1: Session-Backed STEDI Access

**User Story**: As an authenticated browser user, I want STEDI-backed features to work through my app session so that I never need to manage `suresteps.session.token` manually.

**Why P1**: A server-action login is incomplete unless the rest of the STEDI-backed app can use the resulting auth state.

**Acceptance Criteria**:

1. WHEN an authenticated browser/session request reaches a STEDI-backed route THEN the system SHALL resolve the STEDI token from server-side session state instead of requiring a client-supplied `suresteps.session.token` header.
2. WHEN an authenticated session no longer has an associated STEDI token THEN the system SHALL fail with session-expired or unauthorized handling and SHALL not proxy the request anonymously.
3. WHEN a user signs out THEN the system SHALL clear the Better Auth session and remove or invalidate the associated STEDI token mapping.

**Independent Test**: Sign in once, call a STEDI-backed route without a manual legacy header, and verify that the same route fails after sign-out.

---

### P2: Auth Migration and Landing Route

**User Story**: As a developer maintaining the app, I want the existing auth routes and landing behavior aligned with the new session model so that the codebase no longer has conflicting auth contracts.

**Why P2**: The app currently has a second auth implementation built around bearer JWTs; leaving it untouched would preserve incompatible session behavior.

**Acceptance Criteria**:

1. WHEN `/auth/signin` is used after migration THEN the system SHALL authenticate through Better Auth-backed session semantics instead of minting the current custom bearer JWT.
2. WHEN `/dashboard` is requested by an authenticated user THEN the system SHALL render a minimal dashboard placeholder page.
3. WHEN `/dashboard` is requested without an authenticated session THEN the system SHALL redirect the requester to `/login`.
4. WHEN the legacy `/login` POST endpoint is removed THEN the system SHALL migrate repo-owned tests and helpers that depended on it in the same feature.

**Independent Test**: Use the updated auth flow to establish a session, request `/dashboard`, and confirm anonymous requests are redirected to `/login`.

---

### P2: Regression Safety for the Migration

**User Story**: As a maintainer, I want focused auth regression coverage so that the Better Auth/STEDI migration is safe to refactor and verify.

**Why P2**: This feature changes session semantics, route contracts, and deployed integration helpers; regression coverage is part of the deliverable.

**Acceptance Criteria**:

1. WHEN the migration is implemented THEN the system SHALL add unit coverage for the STEDI credentials bridge, server-session token resolution, and login action validation.
2. WHEN the migration is implemented THEN the system SHALL add e2e or integration coverage for login redirect behavior, `/dashboard` access control, and at least one downstream STEDI-backed request using server-side token resolution.
3. WHEN the auth configuration or public route contract changes THEN the system SHALL update project documentation to reflect the new behavior.

**Independent Test**: Run the targeted unit, integration, and e2e commands referenced in the feature tasks and verify the changed auth behavior is covered.

---

## Edge Cases

- WHEN the login form is submitted with blank `username` or `password` THEN the system SHALL reject the submission with field-level validation errors.
- WHEN STEDI returns a non-success login response THEN the system SHALL show a generic authentication failure and SHALL not persist a partial session.
- WHEN a browser session exists but its STEDI token association has been deleted or expired THEN the system SHALL require re-authentication before proxying STEDI-backed requests.
- WHEN a user opens `/dashboard` in a fresh browser without a valid auth cookie THEN the system SHALL redirect to `/login`.
- WHEN old tests or helpers still call `POST /login` after migration THEN the system SHALL fail loudly in CI until those callers are updated.

## Requirement Traceability

Each requirement gets a unique ID for tracking across design, tasks, and validation.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| BALOG-01 | P1: Browser Login With Server Actions | In Tasks | Pending |
| BALOG-02 | P1: Browser Login With Server Actions | In Tasks | Pending |
| BALOG-03 | P1: Browser Login With Server Actions | In Tasks | Pending |
| BALOG-04 | P1: Browser Login With Server Actions | In Tasks | Pending |
| BALOG-05 | P1: Session-Backed STEDI Access | In Tasks | Pending |
| BALOG-06 | P1: Session-Backed STEDI Access | In Tasks | Pending |
| BALOG-07 | P1: Session-Backed STEDI Access | In Tasks | Pending |
| BALOG-08 | P2: Auth Migration and Landing Route | In Tasks | Pending |
| BALOG-09 | P2: Auth Migration and Landing Route | In Tasks | Pending |
| BALOG-10 | P2: Regression Safety for the Migration | In Tasks | Pending |

**ID format:** `[CATEGORY]-[NUMBER]` (e.g., `AUTH-01`, `CART-03`, `NOTIF-02`)

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 10 total, 10 mapped to tasks, 0 unmapped

---

## Success Criteria

How we know the feature is successful:

- [ ] A user can sign in from `/login` and reach `/dashboard` without handling raw STEDI tokens in the browser.
- [ ] At least one STEDI-backed route works for an authenticated browser session without a manual `suresteps.session.token` header.
- [ ] The repo no longer depends on the old `/login` pass-through route or custom bearer JWT issuance for the migrated auth flow.
