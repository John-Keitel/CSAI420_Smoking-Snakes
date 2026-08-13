import { loadEnvConfig } from '@next/env';
import { defineConfig, env } from 'prisma/config';

// Keep Prisma CLI in sync with Next.js env file resolution (.env.local, .env.development.local, etc.).
loadEnvConfig(process.cwd());

type Env = {
    DATABASE_URL: string;
};

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
        seed: 'tsx prisma/seed.ts',
    },
    datasource: {
        url: env<Env>('DATABASE_URL'),
    },
});
