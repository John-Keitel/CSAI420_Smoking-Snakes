# Better Auth STEDI Login Migration Context

**Gathered:** 2026-07-21
**Spec:** `.specs/features/better-auth-stedi-login/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Replace the current browser login path with an App Router page and server action, migrate browser auth to Better Auth-managed sessions, keep STEDI token use server-side, add a minimal `/dashboard`, and update repo-owned auth/tests so the old `/login` token route is no longer required.

---

## Implementation Decisions

### Auth State Ownership

- Better Auth owns the browser-facing session cookie.
- The STEDI session token returned by `/login` is stored server-side and associated with the Better Auth session.
- Browser clients should not supply `suresteps.session.token` manually for the migrated flow.

### Login UX and Routing

- The `/login` route becomes a page-based flow with `page.tsx`, `login.tsx`, and `actions.ts`.
- The login form collects `username` and `password`.
- Successful login redirects to `/dashboard`.
- Failed login stays on `/login` and shows recoverable errors.

### Migration Scope

- Replace the existing `/auth/signin` JWT-based flow with Better Auth-backed behavior as part of the same feature.
- Remove the legacy `/login` POST pass-through route instead of keeping a browser/API dual mode.
- Create only a minimal `/dashboard` placeholder; broader dashboard content is outside this feature.

### Agent's Discretion

- Choose the exact Better Auth session-linking shape for the server-side STEDI token store.
- Choose whether `/auth/signin` becomes a Better Auth compatibility wrapper or maps directly to the Better Auth route surface, as long as the current custom JWT contract is retired.
- Choose the login form presentation details as long as it remains intentionally simple and supports pending/error states.

### Declined / Undiscussed Gray Areas → Assumptions

- `/dashboard` is treated as a protected page that redirects unauthenticated users to `/login`.
- Signup remains outside this feature except for auth infrastructure touch points.
- Non-browser callers that previously POSTed to `/login` must migrate to explicit test helpers or direct STEDI auth rather than relying on a preserved compatibility endpoint.

---

## Specific References

- STEDI auth docs: `/login` returns a session token and downstream STEDI endpoints require the `suresteps.session.token` header.
- Existing code references that shaped the scope:
  - `src/lib/stedi-api.ts` for current STEDI proxy behavior
  - `src/lib/auth/index.ts` for current bearer-JWT app auth
  - `src/lib/auth/suresteps.ts` for current header-based legacy session validation
  - `__test__/integration_tests/IVR.test.ts` for the current `/login`-dependent integration flow

---

## Deferred Ideas

- STEDI two-factor login and birthdate verification flows
- Rich dashboard content or navigation beyond a placeholder landing page
- Preserving a machine-consumable replacement for the old `/login` route
