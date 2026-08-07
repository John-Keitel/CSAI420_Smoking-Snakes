import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { userDeleteMany, loggerMock } = vi.hoisted(() => ({
    userDeleteMany: vi.fn(),
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/db', () => ({
    prisma: {
        user: {
            deleteMany: userDeleteMany,
        },
    },
}));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));

import { DELETE } from '@/app/user/[userId]/route';

function buildRequest(userId: string) {
    return [new NextRequest(`http://localhost/user/${userId}`, { method: 'DELETE' }), { params: Promise.resolve({ userId }) }] as const;
}

beforeEach(() => {
    vi.resetAllMocks();
});

describe('DELETE /user/[userId]', () => {
    it('deletes a user created via chat-assisted registration and answers 204 (CLEAN-01)', async () => {
        userDeleteMany.mockResolvedValue({ count: 1 });

        const response = await DELETE(...buildRequest('cm-user-1'));

        expect(response.status).toBe(204);
        expect(userDeleteMany).toHaveBeenCalledWith({ where: { id: 'cm-user-1' } });
    });

    it('returns 404 with an error body for an unknown user id (CLEAN-02)', async () => {
        userDeleteMany.mockResolvedValue({ count: 0 });

        const response = await DELETE(...buildRequest('cm-user-missing'));

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBe('User not found');
    });
});
