import { expect, test } from '@playwright/test';

import { asDeveloper } from '../../helpers/auth.helper';

// Based on:
// https://playwright.dev/docs/api-testing
test('it should fail 401', async ({ request }) => {
    const users = await request.get(`/users`);
    expect(users.status()).toBe(401);
});

test('it should work 200', async ({ request }) => {
    const headers = await asDeveloper(request);

    const response = await request.get(`/users`, {
        headers,
    });

    expect(response.status()).toBe(200);

    const users = await response.json();
    expect(users).toBeDefined();
});
