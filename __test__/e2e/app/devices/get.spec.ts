import { expect, test } from '@playwright/test';

import { asDeveloper } from '../../helpers/auth.helper';

test('should fail 401 without authentication', async ({ request }) => {
    const response = await request.get('/devices');
    expect(response.status()).toBe(401);
});

test('should return devices when authenticated', async ({ request }) => {
    await asDeveloper(request);

    const response = await request.get('/devices');
    expect(response.status()).toBe(200);

    const devices = await response.json();
    expect(devices).toBeDefined();
});
