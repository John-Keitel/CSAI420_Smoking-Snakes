import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    test: {
        environment: 'node',
        include: ['__test__/integration_tests/**/*.test.ts', '__test__/unit/**/*.test.ts'],
        hookTimeout: 30_000,
        testTimeout: 30_000,
    },
});
