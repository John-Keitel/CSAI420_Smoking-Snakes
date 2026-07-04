import { expect, test } from '@playwright/test';

import { asDeveloper } from '../../helpers/auth.helper';

test('should reject invalid credentials', async ({ request }) => {
    const response = await request.post('/auth/signin', {
        data: {
            email: 'unknown@example.com',
            password: 'wrongpassword',
        },
    });

    expect(response.status()).toBe(400);
});

test('should authenticate a seeded developer', async ({ request }) => {
    const headers = await asDeveloper(request);

    expect(headers.Authorization).toMatch(/^Bearer /);
});
