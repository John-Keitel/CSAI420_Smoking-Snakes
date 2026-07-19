import { beforeEach, describe, expect, it, vi } from 'vitest';

const { chunkMock, sendMock, isTokenMock, loggerMock, prismaMock } = vi.hoisted(() => ({
    chunkMock: vi.fn(),
    sendMock: vi.fn(),
    isTokenMock: vi.fn(),
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
    prismaMock: {
        expoPushToken: {
            updateMany: vi.fn(),
        },
    },
}));

vi.mock('expo-server-sdk', () => {
    class Expo {
        chunkPushNotifications = chunkMock;
        sendPushNotificationsAsync = sendMock;
        static isExpoPushToken = isTokenMock;
    }
    return { Expo, default: Expo };
});
vi.mock('@/lib/db', () => ({ prisma: prismaMock }));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));

import { sendPushNotifications } from '@/lib/notifications/expo-client';

const validToken = 'ExponentPushToken[valid1]';
const validToken2 = 'ExponentPushToken[valid2]';

function message(to: string) {
    return { to, title: 'Your balance score is ready', body: 'B', data: { score: 1 } };
}

describe('sendPushNotifications', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Sensible defaults: every token valid, a single chunk echoing the input,
        // and DB deactivation succeeding.
        isTokenMock.mockReturnValue(true);
        chunkMock.mockImplementation((messages: unknown[]) => [messages]);
        sendMock.mockResolvedValue([]);
        prismaMock.expoPushToken.updateMany.mockResolvedValue({ count: 1 });
    });

    it('filters out messages with an invalid Expo push token before sending', async () => {
        isTokenMock.mockImplementation((token: unknown) => token === validToken);
        sendMock.mockResolvedValue([{ status: 'ok', id: 'r1' }]);

        const summary = await sendPushNotifications([message(validToken), message('not-a-token')]);

        // Only the valid message reaches chunking / sending.
        expect(chunkMock).toHaveBeenCalledWith([expect.objectContaining({ to: validToken })]);
        expect(summary.failed).toBe(1);
        expect(summary.sent).toBe(1);
        expect(summary.deactivated).toBe(0);
    });

    it('groups messages into chunks and sends each chunk', async () => {
        chunkMock.mockReturnValue([[message(validToken)], [message(validToken2)]]);
        sendMock.mockResolvedValue([{ status: 'ok', id: 'r' }]);

        await sendPushNotifications([message(validToken), message(validToken2)]);

        expect(sendMock).toHaveBeenCalledTimes(2);
    });

    it('deactivates a token when a ticket reports DeviceNotRegistered', async () => {
        sendMock.mockResolvedValue([
            { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered', expoPushToken: validToken } },
        ]);

        const summary = await sendPushNotifications([message(validToken)]);

        expect(prismaMock.expoPushToken.updateMany).toHaveBeenCalledWith({
            where: { token: validToken },
            data: { isActive: false },
        });
        expect(summary).toEqual({ sent: 0, failed: 1, deactivated: 1 });
    });

    it('does not deactivate tokens for non-DeviceNotRegistered errors', async () => {
        sendMock.mockResolvedValue([{ status: 'error', message: 'too big', details: { error: 'MessageTooBig' } }]);

        const summary = await sendPushNotifications([message(validToken)]);

        expect(prismaMock.expoPushToken.updateMany).not.toHaveBeenCalled();
        expect(summary).toEqual({ sent: 0, failed: 1, deactivated: 0 });
    });

    it('does not throw when the SDK send fails', async () => {
        sendMock.mockRejectedValue(new Error('network down'));

        const summary = await sendPushNotifications([message(validToken)]);

        expect(summary.failed).toBe(1);
        expect(summary.sent).toBe(0);
        expect(loggerMock.error).toHaveBeenCalled();
    });

    it('returns an accurate summary for a mix of ok and error tickets', async () => {
        sendMock.mockResolvedValue([
            { status: 'ok', id: 'r1' },
            { status: 'ok', id: 'r2' },
            { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered', expoPushToken: validToken2 } },
        ]);

        const summary = await sendPushNotifications([message(validToken), message(validToken), message(validToken2)]);

        expect(summary).toEqual({ sent: 2, failed: 1, deactivated: 1 });
    });
});
