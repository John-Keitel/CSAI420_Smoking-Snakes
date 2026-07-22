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

### Local infrastructure

```bash
docker compose up -d --wait postgres minio mailpit
```

PostgreSQL 18 uses a version-specific data layout. Back up and migrate data from older `postgres_data` volumes before removing them; Compose uses a separate `postgres_18_data` volume to avoid overwriting an older cluster.

MinIO API: http://localhost:9000
MinIO WebUI: http://localhost:9001
MailPit WebUI: http://localhost:8025

### Full application stack

Copy the environment template and replace the auth secrets before starting the API container:

```bash
cp .env.example .env
openssl rand -base64 32
# Put the generated value in BETTER_AUTH_SECRET and AUTH_SECRET inside .env

docker compose up -d --build --wait
curl http://127.0.0.1:3000/health
```

Compose builds the Next.js standalone image, waits for PostgreSQL, applies Prisma migrations once, and then starts the API as a non-root user. PostgreSQL, MinIO, Mailpit, and the API bind to loopback by default.

### Server deployment

After this branch is merged:

```bash
git clone https://github.com/John-Keitel/CSAI420_Smoking-Snakes.git
cd CSAI420_Smoking-Snakes
cp .env.example .env
```

Update these values in `.env`:

- `APP_ENV=production`
- `BETTER_AUTH_SECRET` and `AUTH_SECRET` with a new `openssl rand -base64 32` value
- `BETTER_AUTH_URL` and `NEXTAUTH_URL` with your public API origin
- `NEXTAUTH_URL=https://api.your-domain.example`
- PostgreSQL credentials and both `DOCKER_DATABASE_*` URLs if the defaults are changed

Then deploy and verify:

```bash
docker compose up -d --build --wait
docker compose ps
curl http://127.0.0.1:3000/health
docker compose logs --tail=100 app migrate
```

Terminate TLS with a host reverse proxy such as Caddy or Nginx and forward the public domain to `127.0.0.1:3000`. Do not commit `.env`.

## Auth

```bash
npm run db:seed
```

Browser authentication is migrating to Better Auth-managed session cookies. During the transition, this repo supports both the legacy `AUTH_SECRET` / `NEXTAUTH_URL` names and the Better Auth-native `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` names so the auth layer can switch without forcing an env rename first.

Browser users now sign in through [src/app/login/page.tsx](src/app/login/page.tsx), which authenticates against STEDI server-side, creates a Better Auth session cookie, and stores the opaque STEDI token server-side against that session. Repo-owned machine and raw-token integration helpers should authenticate directly against STEDI instead of POSTing to this app's removed legacy `/login` endpoint.

## API Routes

The application exposes a single Next.js App Router tree under `src/app/`:

- `GET /health` — process health check
- `POST /user` — pass through legacy user creation
- `GET /login` — browser login page backed by a server action
- `POST /customer` — pass through legacy customer creation
- `POST /rapidsteptest` — pass through STEDI IoT step data (Epic 3)
- `POST /sensorUpdates` — pass through STEDI sensor updates (Epic 3)
- `GET /devices/updates/recent` — pass through recent STEDI device updates (Epic 3)
- `GET /riskscore/[email]` — pass through STEDI risk/balance score (Epic 3)
- `POST /api/auth/*` — Better Auth route surface for session management
- `POST /auth/signin` — authenticate a local app user and establish a session cookie
- `POST /auth/signup` — create a new user account
- `DELETE /auth/signout` — invalidate the current session
- `GET /dashboard` — protected post-login landing page
- `GET /users` — list users (authorization-aware)
- `GET|PATCH|DELETE /users/[userId]` — user management
- `GET /devices` — list devices
- `GET|PATCH|DELETE /devices/[deviceId]` — device management
- `GET /assessments` — list assessments
- `GET|PATCH|DELETE /assessments/[assessmentId]` — assessment management
- `POST /steps` — receive step data from a device

The STEDI pass-through endpoints use `STEDI_API_BASE_URL`, which defaults to `https://dev.stedi.me`. Upstream fetches abort after `STEDI_PROXY_TIMEOUT_MS` (default `8000`) and return HTTP `504` on timeout. Epic 3 (Real-Time Data Transmission & Analysis) is V1 pass-through only: this API does not introduce Kafka, SNS, SQS, or EventBridge, and STEDI owns scoring. See `docs/product/epic-3-realtime-data-path.md`.

## Tests

### Deployed IVR integration tests

The assignment integration suite targets this project for the pass-through routes, but authenticates directly against STEDI to obtain the raw `suresteps.session.token` needed by the machine-style legacy endpoints:

```bash
API_URL=https://your-project.vercel.app npm run test:integration
```

`API_URL` must not point directly to `stedi.me` or `dev.stedi.me`. Optionally set `STEDI_API_BASE_URL` if you need to target a non-default STEDI environment for the raw-token bootstrap.

### End-to-end API tests

E2E tests run against a local instance of the application and require Docker services (PostgreSQL, Mailpit) to be running.

```bash
# Start dependencies
docker compose up -d --wait postgres minio mailpit

# Run migrations and seed
npx prisma migrate deploy
npx prisma db seed

# Run Playwright API tests
npm run test:e2e
```

The Playwright suite tests the database-backed routes against the local application.
