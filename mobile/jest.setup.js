// Native modules are unavailable under jest-expo, so both are mocked globally.
// Individual tests override these with jest.doMock + jest.resetModules when they
// need a different configuration (see chatClient.test.js FND-05).

jest.mock('expo-constants', () => ({
    __esModule: true,
    default: {
        expoConfig: {
            extra: {
                apiBaseUrl: 'https://api.test',
            },
        },
    },
}));

jest.mock('expo-crypto', () => {
    let counter = 0;

    return {
        randomUUID: jest.fn(() => `test-session-${++counter}`),
    };
});

// The package ships its own mock rather than a hand-rolled one; it already
// mirrors the real NetInfoState shape (isConnected/isInternetReachable) and
// defaults to "online" so existing tests are unaffected unless they opt in.
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock'));

// AsyncStorage's native module is unavailable under jest-expo; mock the JS
// surface with an in-memory store so sessionStore and any importer of
// ChatSheet render without the native bridge. Individual tests that need to
// assert on persistence override these per-case.
jest.mock('@react-native-async-storage/async-storage', () => {
    const store = new Map();

    return {
        setItem: jest.fn(async (key, value) => {
            store.set(key, value);
        }),
        getItem: jest.fn(async (key) => store.get(key) ?? null),
        removeItem: jest.fn(async (key) => {
            store.delete(key);
        }),
        __store: store,
    };
});
