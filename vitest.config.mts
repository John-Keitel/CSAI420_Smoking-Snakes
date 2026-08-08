import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            // react-native ships Flow syntax Vite's parser rejects; vi.mock() alone
            // doesn't prevent Vite from parsing the real file during resolution, so
            // this is redirected before that ever happens. Only mobile/app/lib/
            // stepRules.js (imported by __test__/contract/mobile-backend-schemas.test.ts)
            // needs this — nothing else in the repo imports react-native.
            'react-native': fileURLToPath(new URL('./__test__/contract/__mocks__/react-native.ts', import.meta.url)),
            // Same reasoning: expo-constants transitively hits expo-modules-core's
            // `__DEV__` global (Metro/RN-injected, undefined under Vite) before
            // vi.mock() would get a chance to intercept it.
            'expo-constants': fileURLToPath(new URL('./__test__/contract/__mocks__/expo-constants.ts', import.meta.url)),
        },
    },
    test: {
        environment: 'node',
        environmentMatch: {
            // Component tests render React into a DOM, so they need jsdom.
            // The rest of the suite (API routes, schemas, libs) stays on node.
            'src/**/*.test.tsx': 'jsdom',
        },
        include: [
            '__test__/contract/**/*.test.ts',
            '__test__/e2e/**/*.test.ts',
            '__test__/integration/**/*.test.ts',
            '__test__/integration_tests/**/*.test.ts',
            '__test__/unit/**/*.test.ts',
            'src/**/*.test.tsx',
        ],
        hookTimeout: 30_000,
        testTimeout: 30_000,
    },
});
