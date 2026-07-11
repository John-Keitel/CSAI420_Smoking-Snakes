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

Copy the environment template and replace `AUTH_SECRET` before starting the API container:

```bash
cp .env.example .env
openssl rand -base64 32
# Put the generated value in AUTH_SECRET inside .env

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
- `AUTH_SECRET` with a new `openssl rand -base64 32` value
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

The JWT implementation now uses versioned `jose` HS256 tokens. Tokens issued by the previous Auth.js encryption implementation are intentionally invalidated by this upgrade; users must sign in again.

## API Routes

The application exposes a single Next.js App Router tree under `src/app/`:

- `GET /health` — process health check
- `POST /user` — pass through legacy user creation
- `POST /login` — pass through legacy authentication
- `POST /customer` — pass through legacy customer creation
- `POST /rapidsteptest` — pass through STEDI IoT step data (Epic 3)
- `POST /sensorUpdates` — pass through STEDI sensor updates (Epic 3)
- `GET /devices/updates/recent` — pass through recent STEDI device updates (Epic 3)
- `GET /riskscore/[email]` — pass through STEDI risk/balance score (Epic 3)
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

The STEDI pass-through endpoints use `STEDI_API_BASE_URL`, which defaults to `https://dev.stedi.me`. Upstream fetches abort after `STEDI_PROXY_TIMEOUT_MS` (default `8000`) and return HTTP `504` on timeout. Epic 3 (Real-Time Data Transmission & Analysis) is V1 pass-through only: this API does not introduce Kafka, SNS, SQS, or EventBridge, and STEDI owns scoring. See `docs/product/epic-3-realtime-data-path.md`.

## Tests

### Deployed IVR integration tests

The assignment integration suite targets this project, which then passes requests through to the legacy API:

```bash
API_URL=https://your-project.vercel.app npm run test:integration
```

`API_URL` must not point directly to `stedi.me` or `dev.stedi.me`.

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
