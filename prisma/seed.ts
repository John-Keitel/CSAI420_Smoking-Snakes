import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';
import { ENV_VARS } from '@/lib/env-vars';

import { seedUsers } from './seeders/user.seeder';

const adapter = new PrismaPg({ connectionString: ENV_VARS.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

(async () => {
    try {
        if (ENV_VARS.APP_ENV === 'local') {
            // local stuff only
        }

        await seedUsers(prisma);
    } catch (e) {
        console.error(e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
})();
