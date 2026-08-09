import NetInfo from '@react-native-community/netinfo';

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
