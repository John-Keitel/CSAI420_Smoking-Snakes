import { _resetSupportCache, isSpeaking, isSupported, speak, stop } from '../app/lib/voiceController';

// jest-expo auto-mocks the expo-speech native module with plain functions, not
// jest.fn(), so an explicit mock with jest.fn() is required for call assertions.
jest.mock('expo-speech', () => ({
    getAvailableVoicesAsync: jest.fn(),
    isSpeakingAsync: jest.fn(async () => false),
    speak: jest.fn(),
    stop: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
}));

// Re-import after the mock is registered so the test module sees the mocked bindings.
const Speech = require('expo-speech');

beforeEach(() => {
    _resetSupportCache();
    Speech.getAvailableVoicesAsync.mockReset();
    Speech.speak.mockReset();
    Speech.stop.mockReset();
});

afterEach(() => {
    jest.clearAllMocks();
    _resetSupportCache();
});

describe('isSupported (VOICE-03)', () => {
    it('resolves true when voices are available', async () => {
        Speech.getAvailableVoicesAsync.mockResolvedValue([{ id: 'en-US' }]);

        await expect(isSupported()).resolves.toBe(true);
    });

    it('resolves false when the voice list is empty', async () => {
        Speech.getAvailableVoicesAsync.mockResolvedValue([]);

        await expect(isSupported()).resolves.toBe(false);
    });

    it('resolves false when the native module throws UnavailabilityError', async () => {
        Speech.getAvailableVoicesAsync.mockRejectedValue(new Error('UnavailabilityError: Speech'));

        await expect(isSupported()).resolves.toBe(false);
    });

    it('caches the result so the native call happens at most once', async () => {
        Speech.getAvailableVoicesAsync.mockResolvedValue([{ id: 'en-US' }]);

        await isSupported();
        await isSupported();
        await isSupported();

        expect(Speech.getAvailableVoicesAsync).toHaveBeenCalledTimes(1);
    });
});

describe('speak (VOICE-01)', () => {
    it('calls Speech.speak with the text', async () => {
        await speak('Hello');

        expect(Speech.speak).toHaveBeenCalledTimes(1);
        expect(Speech.speak.mock.calls[0][0]).toBe('Hello');
    });

    it('stops any in-flight utterance before speaking so turns never overlap', async () => {
        Speech.stop.mockResolvedValue(undefined);
        await speak('First');
        await speak('Second');

        // stop is called once before the second speak (plus any settle calls).
        expect(Speech.stop).toHaveBeenCalled();
    });

    it('ignores empty or non-string text', async () => {
        await speak('');
        await speak(null);
        await speak(undefined);

        expect(Speech.speak).not.toHaveBeenCalled();
    });

    it('invokes the onDone callback when speech finishes', async () => {
        const onDone = jest.fn();
        await speak('Hello', { onDone });

        // Speech.speak receives options with onDone wrapped to settle speaking.
        const options = Speech.speak.mock.calls[0][1];
        options.onDone();

        expect(onDone).toHaveBeenCalledTimes(1);
        expect(isSpeaking()).toBe(false);
    });

    it('invokes the onError callback and clears the speaking flag', async () => {
        const onError = jest.fn();
        await speak('Hello', { onError });

        const options = Speech.speak.mock.calls[0][1];
        options.onError();

        expect(onError).toHaveBeenCalledTimes(1);
        expect(isSpeaking()).toBe(false);
    });
});

describe('stop (VOICE-02, edge case: TTS interrupted)', () => {
    it('calls Speech.stop and clears the speaking flag', async () => {
        await speak('Hello');
        expect(isSpeaking()).toBe(true);

        await stop();

        expect(Speech.stop).toHaveBeenCalled();
        expect(isSpeaking()).toBe(false);
    });

    it('is idempotent when nothing is playing', async () => {
        Speech.stop.mockRejectedValueOnce(new Error('nothing queued'));

        await expect(stop()).resolves.toBeUndefined();
        expect(isSpeaking()).toBe(false);
    });
});