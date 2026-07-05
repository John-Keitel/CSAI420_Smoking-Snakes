import { expect, test } from '@playwright/test';

test('reports that the API process is healthy', async ({ request }) => {
    const response = await request.get('/health');

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
});
