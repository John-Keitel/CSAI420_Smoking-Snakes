import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['__test__/integration_tests/**/*.test.ts'],
        hookTimeout: 30_000,
        testTimeout: 30_000,
    },
});
