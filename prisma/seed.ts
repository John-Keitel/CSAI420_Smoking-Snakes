import { PrismaClient } from '@prisma/client';

import { ENV_VARS } from '@/lib/env-vars';

import { seedUsers } from './seeders/user.seeder';

const prisma = new PrismaClient();

(async () => {
    try {
        if (ENV_VARS.APP_ENV === 'local') {
            // local stuff only
        }

        await seedUsers();
    } catch (e) {
        console.error(e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
})();
