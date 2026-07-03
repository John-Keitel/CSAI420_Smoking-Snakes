import { defineConfig } from '@playwright/test';

const port = 3001;

export default defineConfig({
    testDir: './__test__/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        headless: true,
        baseURL: `http://127.0.0.1:${port}`,
        trace: 'on-first-retry',
    },
    webServer: {
        port,
        command: `npm run dev -- --port ${port}`,
        reuseExistingServer: false,
    },
});
