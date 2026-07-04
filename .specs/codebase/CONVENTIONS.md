# Codebase Conventions

Source of truth for writing code in this repo. Read before implementing any task.
Derived from the existing codebase (Next.js 16 App Router + React 19 + TypeScript 5
+ Prisma 6 + Zod + Winston + NextAuth). Follow what's already here; do not introduce
divergent patterns without an ADR.

## Stack & Tooling

- **Runtime**: Node.js (see `.nvmrc`), Next.js 16 (App Router, Turbopack dev), React 19.
- **Language**: TypeScript 5, `strict: true`, `moduleResolution: bundler`, `target: ES2017`.
- **ORM**: Prisma 6, PostgreSQL. Schema at `prisma/schema.prisma`, migrations under `prisma/migrations/`.
- **Validation**: Zod. Schemas live in `src/lib/schemas.ts` unless feature-scoped.
- **Logging**: Winston via `src/lib/logger`.
- **Auth**: `@auth/core` (NextAuth) via `src/lib/auth`.
- **Mail**: Nodemailer via `src/lib/mailer`.
- **Tests**: Vitest (jsdom, `@vitejs/plugin-react`, `vite-tsconfig-paths`) + Playwright for e2e.

### Commands

| Purpose                | Command                      |
| ---------------------- | ---------------------------- |
| Dev server             | `npm run dev`                |
| Build                  | `npm run build`              |
| Lint                   | `npm run lint`               |
| Lint + autofix         | `npm run lint:fix`           |
| Unit/integration tests | `npm test`                   |
| Integration tests only | `npm run test:integration`   |
| Generate Prisma client | `npm run db:generate`        |
| Push schema to DB      | `npm run db:push`            |
| Apply migrations       | `npm run db:sync`            |
| Seed                   | `npm run db:seed`            |

The gate for a task is the test command that covers the changed behavior (typically
`npm test` for unit, `npm run test:integration` or a Playwright spec for e2e). Lint
must be clean before commit: `npm run lint`.

## Source Layout

There are two `app/` trees. New work goes in `src/`; the root `app/` is legacy.

```
src/
├── app/                # Next.js App Router route handlers (API)
│   ├── <resource>/
│   │   ├── route.ts            # collection endpoints (GET/POST)
│   │   └── [id]/route.ts       # item endpoints (GET/PATCH/DELETE)
├── lib/
│   ├── db.ts                   # Prisma singleton + EntityNotFoundException
│   ├── http.ts                 # HttpException
│   ├── env-vars.ts             # Zod-validated ENV_VARS (single source)
│   ├── schemas.ts              # Zod request schemas
│   ├── auth/                   # NextAuth session helpers (index.ts, types.ts)
│   ├── logger/                 # Winston factory (index.ts, types.ts)
│   ├── mailer/                 # Nodemailer (index.ts, types.ts)
│   ├── validation/             # formatZodErrors
app/                            # LEGACY routes — do not extend; migrate into src/
prisma/
├── schema.prisma
├── migrations/
├── seed.ts
└── seeders/
__test__/
├── integration_tests/         # Vitest, run against deployed API
└── e2e/                       # Playwright specs + helpers
```

- **Path alias**: `@/*` → `./src/*` (see `tsconfig.json`). Always import internal
  modules as `@/lib/...`, never via relative paths that climb out of `src/`.
- **Lib feature folders**: `src/lib/<feature>/index.ts` (barrel) + `types.ts`.
  Import from the barrel: `import { getAppLogger } from '@/lib/logger'`.

## Formatting & Imports

- **Prettier** (`.prettierrc.json`): 4-space indent, single quotes, semicolons,
  trailing comma `es5`, `printWidth: 144`, LF line endings.
- **EditorConfig** (`.editorconfig`): spaces, indent 4, LF, final newline,
  max line 144. Matches Prettier — keep them aligned if either changes.
- **Import order** is enforced by `eslint-plugin-simple-import-sort` (`error`).
  Three groups, blank-line separated:
  1. External packages (`next`, `react`, `zod`, `@prisma/client`, …)
  2. `@/`-aliased internal imports
  3. Relative imports (`./types`)
- **Unused vars**: `@typescript-eslint/no-unused-vars` is `error`. Prefix
  intentionally-unused identifiers with `_` (matches `argsIgnorePattern: ^_`).
- No `console.log` in application code. Use the logger (see Logging). The only
  `console.*` calls permitted are in `src/lib/env-vars.ts` bootstrap, which runs
  before the logger exists.

## Route Handlers (App Router)

Pattern (see `src/app/users/route.ts`, `src/app/users/[userId]/route.ts`):

```ts
import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('api:users');

export async function GET() {
    try {
        const { user: authUser } = await getSession();
        // ... business logic, throw HttpException on controlled failure
        return NextResponse.json(result);
    } catch (e) {
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }
        logger.error('request failed: %s', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
```

Rules:

- One `route.ts` per resource segment; export the HTTP methods it supports
  (`GET`, `POST`, `PATCH`, `DELETE`).
- **Always wrap the handler body in `try/catch`.** Map `HttpException` to
  `{ error: message }` + its `statusCode`; everything else is logged and
  returns `500 { error: 'Server Error' }`. Never leak stack traces or raw
  errors to the client.
- **Controlled failures throw `HttpException(statusCode, message)`** from
  `@/lib/http` — do not build ad-hoc `NextResponse` error shapes inline.
- **Auth first**: call `await getSession()` before any DB work. The returned
  `user.type` (`developer` | `provider` | `standard`) gates access (e.g.,
  `standard` users may only see their own records).
- Resource naming: plural collection segments (`users`, `devices`,
  `assessments`, `steps`); dynamic item id as `[id]`.

## Data Access (Prisma)

- Import the singleton: `import { prisma } from '@/lib/db'`. Do not
  `new PrismaClient()` in route handlers.
- `BigInt.prototype.toJSON` is patched in `src/lib/db.ts` so `Json` fields and
  numeric IDs serialize correctly — rely on it; don't re-patch.
- Throw `EntityNotFoundException` (from `@/lib/db`) for not-found resources,
  then let the route catch map it (extend `HttpException` if you need a status).
- Use Prisma's `where` for authorization scoping when possible
  (e.g., `where: { id, ...ownFilter }`).

### Schema conventions (`prisma/schema.prisma`)

- IDs: `id String @id @default(cuid())`.
- Tables: `@@map("snake_case_plural")`. Columns: `@map("snake_case")`.
- Audit fields on every model: `createdAt DateTime @default(now()) @map("created_at")`
  and `updatedAt DateTime @updatedAt @map("updated_at")`.
- Foreign keys: `<relation>Id String @map("<relation>_id")` + `@relation(..., onDelete: Cascade)`.
- Constrain with `@db.VarChar(n)`, `@unique`, `@db.Date` as appropriate.
- Migrations are deployed via `npm run db:sync` (`prisma migrate deploy`). In dev,
  `npx prisma migrate dev --name <name>`. Regenerate the client after schema
  changes: `npm run db:generate` (also runs on `postinstall`).

## Validation (Zod)

- Define request schemas in `src/lib/schemas.ts` (e.g., `SignUpSchema`,
  `UpdateUserSchema`). Feature-scoped schemas may live with the feature.
- Validate at the boundary (route handler), then trust the inferred type.
- Format errors for the client with `formatZodErrors(zodError)` from
  `@/lib/validation` → `{ message, errors: Record<string, string[]> }`.
- Coerce booleans/dates with `z.boolean({ coerce: true })` /
  `z.date({ coerce: true })` when accepting form input.

## Environment Variables

- **Never** read `process.env.X` directly in application code. Everything flows
  through `ENV_VARS` from `@/lib/env-vars`, which Zod-validates each schema group
  (`AppSchema`, `DatabaseSchema`, `AuthSchema`, `NodeEnvSchema`, `MailerSchema`)
  and `process.exit(1)`s at boot if invalid.
- Adding a new var: extend the relevant schema in `src/lib/env-vars.ts`, add it
  to `.env.example`, and document it in the README.
- `DATABASE_DEBUG=true` enables Prisma query logging; off by default.

## Logging

- Get a logger per module: `const logger = getAppLogger('api:users')`.
  Use a dotted, lowercase module name matching the route/lib path.
- Levels: `logger.debug | info | warn | error`. Use `error` for caught
  exceptions; use `debug`/`info` for normal flow tracing.
- Format with Winston splat (`%s`, `%d`), e.g.
  `logger.error('request failed: %s', e)`. Do not concatenate.
- Production strips colorize and timestamps; dev includes both. Log level is
  controlled by `APP_LOG_LEVEL`.

## Auth

- `import { getSession } from '@/lib/auth'` → `const { user } = await getSession()`.
- `user.type` discriminates privileges (`developer` > `provider` > `standard`).
- Passwords hashed with `bcrypt`; never log or return password hashes.
- `AUTH_SECRET`, `NEXTAUTH_URL`, `AUTH_TRUST_HOST` are required env vars.

## Tests

- **Unit / component**: Vitest. Config: `vitest.config.mts` (jsdom,
  `vite-tsconfig-paths` so `@/` resolves, `@vitejs/plugin-react`).
  Run: `npm test`.
- **Integration**: `__test__/integration_tests/`, run against a **deployed** API
  (`npm run test:integration`). Set `API_URL` in `.env`. Tests fail if they hit
  production stedi.me domains — run them against your own Vercel deployment.
- **E2E**: Playwright under `__test__/e2e/`, config in `playwright.config.ts`.
  Auth helper: `__test__/e2e/helpers/auth.helper.ts`.
- Tests are part of the task that changes behavior — not separate tasks.
  Derive assertions from the slice spec's acceptance criteria; assert
  spec-defined outcomes, never the implementation shape.

## Error Handling Summary

| Situation              | Mechanism                                              |
| ---------------------- | ------------------------------------------------------ |
| Controlled HTTP error  | `throw new HttpException(statusCode, message)`        |
| Entity not found       | `throw new EntityNotFoundException(message)`           |
| Invalid request body   | Zod parse → `formatZodErrors()` → 400                 |
| Uncaught in handler    | `logger.error('request failed: %s', e)` → 500 generic |
| Invalid env at boot    | `process.exit(1)` in `env-vars.ts`                     |

Never expose raw errors, SQL, or stack traces in HTTP responses.

## Git & Commits

- One atomic commit per task (per the SDD flow). Never batch tasks.
- Do not weaken, skip, or delete tests to make a gate pass.
- `npm run lint` must be clean before committing.
- Do not commit `.env*` (gitignored); keep `.env.example` in sync.
- Do not commit generated Prisma client (`generated/prisma/` is gitignored).
