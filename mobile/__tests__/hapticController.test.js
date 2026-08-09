import {
    _resetSupportCache,
    errorOccurred,
    isSupported,
    messageSent,
} from '../app/lib/hapticController';

// jest-expo auto-mocks native modules with plain functions, not jest.fn(), so
// an explicit mock with jest.fn() is required for call assertions (same
// reason voiceController.test.js mocks expo-speech explicitly).
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    selectionAsync: jest.fn(),
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

const Haptics = require('expo-haptics');

beforeEach(() => {
    _resetSupportCache();
    Haptics.impactAsync.mockReset();
    Haptics.notificationAsync.mockReset();
});

afterEach(() => {
    jest.clearAllMocks();
    _resetSupportCache();
});

describe('isSupported', () => {
    it('is optimistic before any real attempt has been made', () => {
        expect(isSupported()).toBe(true);
    });

    it('stays true after a successful attempt', async () => {
        Haptics.impactAsync.mockResolvedValue(undefined);

        await messageSent();

        expect(isSupported()).toBe(true);
    });

    it('flips to false once a real attempt fails', async () => {
        Haptics.impactAsync.mockRejectedValue(new Error('UnavailabilityError: Haptics'));

        await messageSent();

        expect(isSupported()).toBe(false);
    });

    it('resets back to optimistic', async () => {
        Haptics.impactAsync.mockRejectedValue(new Error('UnavailabilityError: Haptics'));
        await messageSent();
        expect(isSupported()).toBe(false);

        _resetSupportCache();

        expect(isSupported()).toBe(true);
    });
});

describe('messageSent (HAPTIC-01)', () => {
    it('fires a light impact', async () => {
        Haptics.impactAsync.mockResolvedValue(undefined);

        await messageSent();

        expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    });

    it('does not throw when the device has no haptics engine', async () => {
        Haptics.impactAsync.mockRejectedValue(new Error('UnavailabilityError: Haptics'));

        await expect(messageSent()).resolves.toBeUndefined();
    });

    it('stops calling the native module once support is known to be false', async () => {
        Haptics.impactAsync.mockRejectedValue(new Error('UnavailabilityError: Haptics'));
        await messageSent();
        expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

        await messageSent();
        await messageSent();

        // No further bridge calls once a device is known not to support it.
        expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    });
});

describe('errorOccurred (HAPTIC-02)', () => {
    it('fires the error notification pattern', async () => {
        Haptics.notificationAsync.mockResolvedValue(undefined);

        await errorOccurred();

        expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');
    });

    it('does not throw when the device has no haptics engine', async () => {
        Haptics.notificationAsync.mockRejectedValue(new Error('UnavailabilityError: Haptics'));

        await expect(errorOccurred()).resolves.toBeUndefined();
    });

    it('shares the support cache with messageSent', async () => {
        Haptics.impactAsync.mockRejectedValue(new Error('UnavailabilityError: Haptics'));
        await messageSent();

        await errorOccurred();

        expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    });
});
