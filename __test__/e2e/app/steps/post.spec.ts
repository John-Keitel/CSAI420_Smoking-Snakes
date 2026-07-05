import { expect, test } from '@playwright/test';

// Based on:
// https://playwright.dev/docs/api-testing
test('it should work', async ({ request }) => {
    const response = await request.post(`/steps`, {
        data: {
            deviceId: '1234567890',
            stepPoints: [100, 200, 300],
            totalSteps: 3,
        },
    });

    expect(response.status()).toBe(202);
    expect(await response.body()).toHaveLength(0);
});
