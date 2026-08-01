import { Prisma, type User } from '@/generated/prisma/client';
import { hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';

export type CreateChatAssistedUserArgs = {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    birthDate: Date;
    phone?: string;
};

// No findUnique pre-check: User.email already has a @unique constraint, so create() below is
// the sole, atomic source of truth for uniqueness. A separate pre-check would (a) cost a full
// extra round-trip on every request for a guarantee the constraint already gives for free, and
// (b) still race — two requests for the same email could both pass the pre-check and only one
// create() would win, so the loser has to be handled here regardless. Catching P2002 is the only
// version of this check that's actually correct under concurrency.
export async function createChatAssistedUser(args: CreateChatAssistedUserArgs): Promise<User> {
    const hashedPassword = await hashPassword(args.password);

    try {
        return await prisma.user.create({
            data: {
                email: args.email,
                password: hashedPassword,
                firstName: args.firstName,
                lastName: args.lastName,
                dateOfBirth: args.birthDate,
                // User.phone is NOT NULL (@db.VarChar(32)) but chat-assisted payloads don't always
                // include it — the assistant may not have collected it yet. Default to an empty
                // string rather than loosening the column for this one flow.
                phone: args.phone ?? '',
            },
        });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new HttpException(409, 'email is taken');
        }
        throw error;
    }
}
