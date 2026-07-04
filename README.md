# Getting Started

## Opencode Setup

```bash
npm i -g opencode-ai
```

### Model Economics

Planning: GLM-5.2
Implementation: Kimi K2.7 Code
Quick fixes: DeepSeek V4 Flash

### Jira/Confluence

```bash
opencode mcp auth atlassian
```

### Context7

```bash
export CONTEXT7_API_KEY="secret"
```

Based on:
https://nextjs.org/blog/building-apis-with-nextjs#11-create-a-nextjs-app

First, run the development server:

```bash
npm run dev
```

## Prisma ORM

https://www.prisma.io/docs/getting-started/setup-prisma/start-from-scratch/relational-databases-typescript-postgresql

```bash
npm install prisma --save-dev
npx prisma init --datasource-provider postgresql --output ../generated/prisma
```

## Prisma Migrations

```bash
# Create a new migration
npx prisma migrate dev --name init

# Apply the migration
npx prisma migrate deploy
```

## Prisma Client

```bash
npm install @prisma/client

# Generate the types for the Prisma Client
npx prisma generate
```

## Zod Validation

```bash
npm install zod
```

## Docker

```bash
docker compose up -d
```

PostgreSQL 18 uses a version-specific data layout. Back up and migrate data from older `postgres_data` volumes before removing them; Compose uses a separate `postgres_18_data` volume to avoid overwriting an older cluster.

MinIO WebUI: http://localhost:9000
MailPit WebUI: http://localhost:8025

## Auth

```bash
npm install bcrypt
npm install @types/bcrypt --save-dev
```

## API Routes

The application exposes a single Next.js App Router tree under `src/app/`:

- `POST /user` — pass through legacy user creation
- `POST /login` — pass through legacy authentication
- `POST /customer` — pass through legacy customer creation
- `POST /rapidsteptest` — pass through legacy IoT step data
- `GET /riskscore/[email]` — pass through legacy risk-score requests
- `POST /auth/signin` — authenticate and receive a JWT
- `POST /auth/signup` — create a new user account
- `DELETE /auth/signout` — invalidate the current session
- `GET /users` — list users (authorization-aware)
- `GET|PATCH|DELETE /users/[userId]` — user management
- `GET /devices` — list devices
- `GET|PATCH|DELETE /devices/[deviceId]` — device management
- `GET /assessments` — list assessments
- `GET|PATCH|DELETE /assessments/[assessmentId]` — assessment management
- `POST /steps` — receive step data from a device

The legacy migration endpoints use `STEDI_API_BASE_URL`, which defaults to `https://dev.stedi.me`.

## Tests

### Deployed IVR integration tests

```bash
API_URL=https://your-project.vercel.app npm run test:integration
```

`API_URL` must point to this project rather than directly to the legacy API.

### End-to-end API tests

E2E tests run against a local instance of the application and require Docker services (PostgreSQL, Mailpit) to be running.

```bash
# Start dependencies
docker compose up -d

# Run migrations and seed
docker compose exec -it postgres psql -U stedi -c "CREATE DATABASE stedi;" || true
npx prisma migrate deploy
npx prisma db seed

# Run Playwright API tests
npm run test:e2e
```

The Playwright suite tests the database-backed routes against the local application.
