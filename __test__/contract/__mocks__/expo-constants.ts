/**
 * Minimal stand-in for `expo-constants`, used only so mobile/app/api/chatClient.js's
 * `import Constants from 'expo-constants'` resolves under Vitest without pulling in
 * the real package (which transitively hits expo-modules-core's `__DEV__` global,
 * injected by Metro/React Native at runtime and undefined under Node/Vite).
 * Aliased in via vitest.config.mts's resolve.alias — see that file and
 * __test__/contract/__mocks__/react-native.ts for why this is a resolution-level
 * alias rather than vi.mock().
 */
export default {
    expoConfig: { extra: { apiBaseUrl: 'https://api.test' } },
};
