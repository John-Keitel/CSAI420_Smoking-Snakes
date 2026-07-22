# STATE

## Decisions

### AD-001

- **Decision**: Browser-facing authentication will use Better Auth-managed session cookies, while the opaque STEDI session token is stored and resolved server-side.
- **Reason**: The new login flow must work through App Router server actions without exposing `suresteps.session.token` in browser-managed headers or client state.
- **Trade-off**: This adds migration work across existing auth helpers, route handlers, tests, and Prisma persistence instead of keeping the current thin `/login` proxy.
- **Scope**: Auth/session handling, STEDI-backed route access, login/logout UX, test helpers.
- **Date**: 2026-07-21
- **Status**: active

### AD-002

- **Decision**: The `/login` browser entry point will become a page-based App Router flow (`page.tsx` + client form + server action), and the legacy `/login` POST pass-through endpoint will be removed.
- **Reason**: The requested login experience requires server actions, pending/error UI, and cookie-backed auth state rather than a raw token-issuing route.
- **Trade-off**: Existing tests and any non-browser callers that POST to `/login` must migrate in the same change.
- **Scope**: `src/app/login`, auth route migration, deployed integration tests, developer docs.
- **Date**: 2026-07-21
- **Status**: active

## Handoff

- **Feature**: `.specs/features/better-auth-stedi-login/`
- **Phase / Task**: Planning complete — spec/design/tasks drafted for review
- **Completed**: `spec.md`, `context.md`, `design.md`, `tasks.md`, `STATE.md`
- **In-progress** (file:line): none
- **Next step**: Review the saved spec set, then either revise the planning docs or start implementation from `tasks.md` in a separate execution session.
- **Blockers**: Better Auth adapter table contract should be confirmed from official docs during implementation before generating migrations.
- **Uncommitted files**: `.specs/STATE.md`, `.specs/LESSONS.md`, `.specs/lessons.json`,
  `.specs/features/better-auth-stedi-login/spec.md`,
  `.specs/features/better-auth-stedi-login/context.md`,
  `.specs/features/better-auth-stedi-login/design.md`,
  `.specs/features/better-auth-stedi-login/tasks.md`
- **Branch**: `teacher-contribution-week-4`
