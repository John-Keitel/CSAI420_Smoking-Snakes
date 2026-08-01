import type { User } from '@/generated/prisma/client';
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

export async function createChatAssistedUser(args: CreateChatAssistedUserArgs): Promise<User> {
    const existingUser = await prisma.user.findUnique({
        where: { email: args.email },
        select: { id: true },
    });

    if (existingUser) {
        throw new HttpException(409, 'email is taken');
    }

    const hashedPassword = await hashPassword(args.password);

    return prisma.user.create({
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
}
