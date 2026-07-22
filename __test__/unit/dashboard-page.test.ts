import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAuthenticatedSessionMock, redirectMock } = vi.hoisted(() => ({
    getAuthenticatedSessionMock: vi.fn(),
    redirectMock: vi.fn((location: string) => {
        throw new Error(`REDIRECT:${location}`);
    }),
}));

vi.mock('next/navigation', () => ({
    redirect: redirectMock,
}));

vi.mock('@/lib/auth', () => ({
    getAuthenticatedSession: getAuthenticatedSessionMock,
}));

describe('dashboard page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('redirects anonymous users to /login', async () => {
        getAuthenticatedSessionMock.mockResolvedValue(null);

        const { default: DashboardPage } = await import('@/app/dashboard/page');

        await expect(DashboardPage()).rejects.toThrow('REDIRECT:/login');
    });

    it('renders for authenticated users', async () => {
        getAuthenticatedSessionMock.mockResolvedValue({
            user: {
                name: 'Pat Ient',
                email: 'patient@example.com',
            },
        });

        const { default: DashboardPage } = await import('@/app/dashboard/page');
        const page = await DashboardPage();

        expect(page).toBeTruthy();
        expect(redirectMock).not.toHaveBeenCalled();
    });
});
