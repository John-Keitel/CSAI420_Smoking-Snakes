## Getting Started

Based one:
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
docker-compose up -d
```

MinIO WebUI: http://localhost:9000
MailPit WebUI: http://localhost:8025

## Auth

```bash
npm install bcrypt
npm install @types/bcrypt --save-dev
```

## Integration Tests

Integration tests are designed to test your deployed API. Before running them:

1. Deploy your API to Vercel
2. Get your Vercel domain (should look like: `https://your-project-name.vercel.app`)
3. Create a `.env` file in the root directory and add:
   ```
   API_URL=https://your-vercel-domain.vercel.app
   ```
4. Run the integration tests:
   ```bash
   npm run test:integration
   ```

**Important:** Integration tests must run against your own deployed API, not the production stedi.me domains. The tests will check this and fail if they detect production domains.
