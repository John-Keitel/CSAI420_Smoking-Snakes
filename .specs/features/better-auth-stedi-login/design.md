# Better Auth STEDI Login Migration Design

**Spec**: `.specs/features/better-auth-stedi-login/spec.md`
**Status**: Draft

---

## Architecture Overview

The migration introduces a single browser-facing auth model: a Better Auth session cookie backed by server-side session persistence. The login server action becomes the orchestration point that validates form data, authenticates against STEDI, creates or enriches the app session, stores the opaque STEDI token server-side, and redirects to `/dashboard`. Downstream STEDI-backed routes stop trusting client-provided legacy headers and instead resolve the STEDI token from the authenticated server session before proxying.

```mermaid
graph TD
    A[Browser visits /login] --> B[login page.tsx]
    B --> C[login.tsx client form]
    C --> D[actions.ts server action]
    D --> E[STEDI credentials bridge]
    E --> F[STEDI /login]
    D --> G[Better Auth session layer]
    G --> H[App auth persistence]
    G --> I[STEDI session token link]
    D --> J[/dashboard redirect]
    K[Authenticated route request] --> G
    G --> I
    I --> L[proxyToStedi / validateSureStepsSession]
    L --> M[STEDI protected endpoint]
```

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --------- | -------- | ---------- |
| STEDI proxy helper | `src/lib/stedi-api.ts` | Extend it so authenticated browser requests can resolve the STEDI token server-side instead of only reading the incoming legacy header. |
| Legacy STEDI session validator | `src/lib/auth/suresteps.ts` | Rework it to support session-derived STEDI tokens for app/browser flows while preserving explicit header handling where still needed. |
| Current app auth abstraction | `src/lib/auth/index.ts` | Replace the bearer-token session lookup entry points rather than creating a second parallel auth helper API. |
| Existing auth route segments | `src/app/auth/signin/route.ts`, `src/app/auth/signout/route.ts` | Migrate or wrap these routes so callers no longer depend on the custom JWT implementation. |
| UI button primitive | `src/components/ui/button.tsx` | Reuse for the login form submit action to match the existing UI system. |
| Current page shell pattern | `src/app/page.tsx` | Reuse the simple App Router page composition pattern for `/login` and `/dashboard`. |

### Integration Points

| System | Integration Method |
| ------ | ------------------ |
| STEDI API | Server-side credential login via `/login`, then downstream header injection using the server-resolved STEDI token. |
| Prisma database | Add Better Auth persistence and an app-owned STEDI-session-link model keyed to the Better Auth session. |
| Existing App Router routes | Replace bearer/header assumptions in auth-sensitive routes and helpers with Better Auth session resolution. |
| Test suites | Update unit, e2e, and deployed integration helpers to the new session contract. |

---

## Components

### Better Auth Server Configuration

- **Purpose**: Centralize Better Auth setup, session behavior, and route wiring.
- **Location**: `src/lib/auth/` and a new Better Auth route handler under `src/app/api/auth/`
- **Interfaces**:
    - `getAuth()` - returns the configured Better Auth server instance
    - `getAuthenticatedSession()` - resolves the current Better Auth session for server-side callers
- **Dependencies**: Better Auth package(s), Prisma adapter/persistence, environment configuration
- **Reuses**: Existing env loading and the current `src/lib/auth/index.ts` abstraction boundary

### STEDI Credentials Bridge

- **Purpose**: Validate submitted credentials, call STEDI `/login`, normalize upstream failures, and return the opaque token for session binding.
- **Location**: `src/lib/auth/stedi-login.ts`
- **Interfaces**:
    - `authenticateWithStedi(input: { username: string; password: string }): Promise<{ token: string }>` - performs the upstream login
- **Dependencies**: `fetch`, `ENV_VARS.STEDI_API_BASE_URL`, logger, shared Zod validation schema
- **Reuses**: Timeout/error patterns from `src/lib/stedi-api.ts`

### STEDI Session Link Repository

- **Purpose**: Persist and resolve the STEDI token associated with an authenticated Better Auth session.
- **Location**: `src/lib/auth/stedi-session-link.ts`
- **Interfaces**:
    - `upsertStediSessionLink(sessionId: string, token: string, username: string): Promise<void>`
    - `getStediTokenForSession(sessionId: string): Promise<string | null>`
    - `deleteStediSessionLink(sessionId: string): Promise<void>`
- **Dependencies**: Prisma client, Better Auth session IDs
- **Reuses**: Existing Prisma access patterns from `src/lib/db`

### Login Route Segment

- **Purpose**: Render the login page, collect user input, and invoke the server action.
- **Location**: `src/app/login/page.tsx`, `src/app/login/login.tsx`, `src/app/login/actions.ts`
- **Interfaces**:
    - `loginAction(previousState, formData)` - validates input, authenticates, creates the session, redirects or returns field/general errors
    - `LoginForm` props - action state + pending rendering
- **Dependencies**: Better Auth server config, STEDI credentials bridge, UI primitives, Next redirect/cookies behavior, shared Zod login schema
- **Reuses**: Existing App Router page pattern and `src/components/ui/button.tsx`

### Auth Compatibility Routes

- **Purpose**: Migrate `/auth/signin` and `/auth/signout` away from the custom JWT model while keeping explicit route entry points where the app already expects them.
- **Location**: `src/app/auth/signin/route.ts`, `src/app/auth/signout/route.ts`
- **Interfaces**:
    - `POST /auth/signin` - session-oriented sign-in behavior backed by Better Auth/STEDI bridge
    - `DELETE /auth/signout` - session-aware sign-out and STEDI token cleanup
- **Dependencies**: Better Auth session APIs, STEDI session link repository
- **Reuses**: Existing route locations and validation/error formatting patterns

### Dashboard Placeholder

- **Purpose**: Provide a real post-login destination and a minimal authenticated landing page.
- **Location**: `src/app/dashboard/page.tsx`
- **Interfaces**:
    - App Router page render only
- **Dependencies**: Better Auth session check, redirect to `/login` for anonymous requests
- **Reuses**: Existing page layout pattern in `src/app/page.tsx`

---

## Data Models (if applicable)

### LoginActionState

```typescript
interface LoginActionState {
    fieldErrors?: {
        username?: string[];
        password?: string[];
    };
    formError?: string;
}
```

**Relationships**: Returned by the server action and consumed by `login.tsx`.

### LoginInputSchema

```typescript
const LoginSchema = z.object({
    username: z.string().min(1, 'required'),
    password: z.string().min(1, 'required'),
});
```

**Relationships**: Defined in `src/lib/schemas.ts` and reused by the login server action, STEDI credentials bridge, and any compatibility auth route that accepts the same credential payload.

### StediSessionLink

```typescript
interface StediSessionLink {
    id: string;
    sessionId: string;
    username: string;
    stediToken: string;
    createdAt: Date;
    updatedAt: Date;
}
```

**Relationships**: Belongs to a Better Auth session record; used by login, sign-out, and STEDI proxy/session resolution.

### Better Auth Persistence

The Better Auth-owned tables and exact adapter schema are intentionally not hard-coded in this design because the adapter contract needs to be confirmed from official Better Auth documentation during implementation. The app-owned `StediSessionLink` model remains the stable contract for this feature regardless of the exact Better Auth table names.

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| -------------- | -------- | ----------- |
| Invalid username/password | Return a generic login failure in the server action or compatibility route; do not create a session | User stays on `/login` and can retry |
| STEDI timeout / upstream unavailable | Map to recoverable auth failure, log it, do not persist partial session state | User sees retryable error |
| Missing server-side STEDI token for an authenticated session | Treat as expired auth state, clear the inconsistent session association where appropriate, require re-login | User is redirected or receives unauthorized handling |
| Anonymous access to `/dashboard` | Redirect to `/login` | User is sent back to the login page |

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
| ------- | -------------------- | ------ | ---------- |
| Current app auth requires `authorization: Bearer ...` headers and cannot read cookie-backed sessions | `src/lib/auth/index.ts:54` | Protected app routes will remain incompatible with the new login flow if left unchanged | Replace the current session lookup with a Better Auth-backed server session resolver and migrate callers through the existing auth abstraction |
| Legacy STEDI auth validation trusts only `suresteps.session.token` on the incoming request | `src/lib/auth/suresteps.ts:66` | Browser sessions would still need to leak the STEDI token into client-controlled headers | Add server-side token resolution from the Better Auth session link while preserving explicit header support only where still needed |
| Deployed integration coverage currently logs in by POSTing to the app's `/login` endpoint | `__test__/integration_tests/IVR.test.ts:56` | Removing `/login` without test migration will break CI and hide auth regressions | Rewrite the deployed integration helper to authenticate through the new flow or directly against STEDI for raw-token use cases |
| The exact Better Auth adapter table contract was not verified from retrievable adapter docs during planning | `N/A (library integration)` | A wrong migration shape would cause rework during implementation | Confirm the official Better Auth adapter contract before generating Prisma migrations; keep STEDI token linkage in a dedicated app-owned table either way |

---

## Tech Decisions (only non-obvious ones)

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Browser auth state | Better Auth session cookie + server-side STEDI token link | Meets the requested server-action UX without exposing legacy STEDI tokens to the browser |
| `/login` route shape | `page.tsx` + `login.tsx` + `actions.ts` under `/login` | Matches the requested App Router/server-action architecture |
| Login input validation | Shared Zod schema in `src/lib/schemas.ts` | Matches the repo's existing validation pattern and keeps server action, bridge, and route compatibility logic aligned |
| Legacy `/login` callers | Migrate repo-owned callers instead of preserving a compatibility endpoint | Avoids sustaining two incompatible login contracts |

> **Project-level decisions:** The browser-session model and `/login` replacement were promoted into `.specs/STATE.md` as AD-001 and AD-002 because they set cross-feature auth conventions.
