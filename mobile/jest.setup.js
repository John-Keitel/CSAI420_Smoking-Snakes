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
