import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
    stediSessionLink: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
        deleteMany: vi.fn(),
    },
}));

vi.mock('@/lib/db', () => ({
    prisma: prismaMock,
}));

describe('stedi-session-link repository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('upserts a session-to-token mapping', async () => {
        const { upsertStediSessionLink } = await import('@/lib/auth/stedi-session-link');

        await upsertStediSessionLink('session-1', 'token-1', 'patient@example.com');

        expect(prismaMock.stediSessionLink.upsert).toHaveBeenCalledWith({
            where: { sessionId: 'session-1' },
            create: {
                sessionId: 'session-1',
                stediToken: 'token-1',
                username: 'patient@example.com',
            },
            update: {
                stediToken: 'token-1',
                username: 'patient@example.com',
            },
        });
    });

    it('returns the stored STEDI token for a session', async () => {
        prismaMock.stediSessionLink.findUnique.mockResolvedValue({ stediToken: 'token-1' });

        const { getStediTokenForSession } = await import('@/lib/auth/stedi-session-link');

        await expect(getStediTokenForSession('session-1')).resolves.toBe('token-1');
    });

    it('returns null when the session has no STEDI token mapping', async () => {
        prismaMock.stediSessionLink.findUnique.mockResolvedValue(null);

        const { getStediTokenForSession } = await import('@/lib/auth/stedi-session-link');

        await expect(getStediTokenForSession('session-1')).resolves.toBeNull();
    });

    it('deletes a session-to-token mapping', async () => {
        const { deleteStediSessionLink } = await import('@/lib/auth/stedi-session-link');

        await deleteStediSessionLink('session-1');

        expect(prismaMock.stediSessionLink.deleteMany).toHaveBeenCalledWith({
            where: { sessionId: 'session-1' },
        });
    });
});
