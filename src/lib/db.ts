import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';
import { ENV_VARS } from '@/lib/env-vars';

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface BigInt {
        toJSON: () => number;
    }
}

// Ensure this only runs once to avoid re-declaration errors.
if (!BigInt.prototype.toJSON) {
    BigInt.prototype.toJSON = function () {
        return Number(this);
    };
}

const getPrismaClient = () => {
    const adapter = new PrismaPg({ connectionString: ENV_VARS.DATABASE_URL });
    return new PrismaClient({
        adapter,
        log: ENV_VARS.DATABASE_DEBUG ? ['query', 'info', 'warn'] : [],
    });
};

const globalForPrisma = globalThis as unknown as { prisma: ReturnType<typeof getPrismaClient> };

export const prisma = globalForPrisma.prisma || getPrismaClient();

// This is only for development purposes.
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Errors
export class EntityNotFoundException extends Error {
    constructor(message: string) {
        super(message);
    }
}
