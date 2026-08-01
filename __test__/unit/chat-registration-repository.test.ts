import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Prisma } from '@/generated/prisma/client';
import { HttpException } from '@/lib/http';

const { hashPasswordMock, userCreateMock, userFindUniqueMock } = vi.hoisted(() => ({
    hashPasswordMock: vi.fn(),
    userCreateMock: vi.fn(),
    userFindUniqueMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ hashPassword: hashPasswordMock }));
vi.mock('@/lib/db', () => ({
    prisma: {
        user: {
            create: userCreateMock,
            findUnique: userFindUniqueMock,
        },
    },
}));

import { createChatAssistedUser } from '@/lib/chat-registration/repository';

const args = {
    email: 'chat_user@example.com',
    password: 'Str0ngP@ssw0rd!',
    firstName: 'ChatBot',
    lastName: 'TestUser',
    birthDate: new Date('1990-01-01'),
    phone: '8014567890',
};

function uniqueConstraintError() {
    return new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`email`)', {
        code: 'P2002',
        clientVersion: '7.8.0',
    });
}

describe('createChatAssistedUser', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        hashPasswordMock.mockResolvedValue('hashed-password');
    });

    it('creates the user directly, without a findUnique pre-check', async () => {
        const fakeUser = { id: 'user_1', email: args.email };
        userCreateMock.mockResolvedValue(fakeUser);

        const result = await createChatAssistedUser(args);

        expect(result).toBe(fakeUser);
        expect(userCreateMock).toHaveBeenCalledWith({
            data: {
                email: args.email,
                password: 'hashed-password',
                firstName: args.firstName,
                lastName: args.lastName,
                dateOfBirth: args.birthDate,
                phone: args.phone,
            },
        });
        // The whole point of removing the pre-check: uniqueness is enforced by create()'s own
        // constraint, not a separate read beforehand.
        expect(userFindUniqueMock).not.toHaveBeenCalled();
    });

    it('maps a P2002 unique-constraint violation from create() to a 409 HttpException', async () => {
        userCreateMock.mockRejectedValue(uniqueConstraintError());

        const error = await createChatAssistedUser(args).catch((caught) => caught);

        expect(error).toBeInstanceOf(HttpException);
        expect(error.statusCode).toBe(409);
        expect(error.message).toBe('email is taken');
    });

    it('defaults phone to an empty string when omitted', async () => {
        userCreateMock.mockResolvedValue({ id: 'user_2' });

        await createChatAssistedUser({ ...args, phone: undefined });

        expect(userCreateMock).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ phone: '' }) }));
    });

    it('does not swallow non-P2002 errors from create()', async () => {
        const otherPrismaError = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
            code: 'P2003',
            clientVersion: '7.8.0',
        });
        userCreateMock.mockRejectedValue(otherPrismaError);

        await expect(createChatAssistedUser(args)).rejects.toBe(otherPrismaError);
    });

    it('does not swallow non-Prisma errors from create()', async () => {
        const genericError = new Error('connection reset');
        userCreateMock.mockRejectedValue(genericError);

        await expect(createChatAssistedUser(args)).rejects.toBe(genericError);
    });
});
