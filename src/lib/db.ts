import { PrismaClient } from '@prisma/client';

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
    return new PrismaClient({
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
