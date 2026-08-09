import { act, renderHook } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';

import { useIsOffline } from '../app/lib/network';

describe('NetInfo mock wiring', () => {
    it('resolves the package-provided default state from fetch()', async () => {
        // Proves jest.setup.js's global jest.mock actually intercepts the real
        // package import path, not just a local jest.mock in this file - if the
        // wiring were broken, this would hit the real native module and throw
        // under jest-expo instead of resolving.
        await expect(NetInfo.fetch()).resolves.toMatchObject({
            isConnected: true,
            isInternetReachable: true,
        });
    });

    it('addEventListener returns an unsubscribe function', () => {
        const unsubscribe = NetInfo.addEventListener(() => {});

        expect(typeof unsubscribe).toBe('function');
    });
});

describe('useIsOffline', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    // The mock's addEventListener is a plain jest.fn(): unlike the real
    // package, it does not invoke the listener on subscribe, so every
    // connectivity change here is fired by hand via the captured callback.
    const latestListener = () => NetInfo.addEventListener.mock.calls.at(-1)[0];

    it('starts online', () => {
        const { result } = renderHook(() => useIsOffline());

        expect(result.current).toBe(false);
    });

    it('flips to true once NetInfo reports isConnected: false', () => {
        const { result } = renderHook(() => useIsOffline());

        act(() => {
            latestListener()({ isConnected: false, isInternetReachable: false });
        });

        expect(result.current).toBe(true);
    });

    it('flips back to false once connectivity returns', () => {
        const { result } = renderHook(() => useIsOffline());

        act(() => {
            latestListener()({ isConnected: false });
        });
        act(() => {
            latestListener()({ isConnected: true });
        });

        expect(result.current).toBe(false);
    });

    it('treats isConnected: null (still determining) as online, not offline', () => {
        const { result } = renderHook(() => useIsOffline());

        act(() => {
            latestListener()({ isConnected: null, isInternetReachable: null });
        });

        expect(result.current).toBe(false);
    });

    it('unsubscribes on unmount', () => {
        const unsubscribe = jest.fn();
        NetInfo.addEventListener.mockReturnValueOnce(unsubscribe);

        const { unmount } = renderHook(() => useIsOffline());
        unmount();

        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
});
