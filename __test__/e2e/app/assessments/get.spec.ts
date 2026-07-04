import { expect, test } from '@playwright/test';

import { asDeveloper } from '../../helpers/auth.helper';

test('should fail 401 without authentication', async ({ request }) => {
    const response = await request.get('/assessments');
    expect(response.status()).toBe(401);
});

test('should return assessments when authenticated', async ({ request }) => {
    const headers = await asDeveloper(request);

    const response = await request.get('/assessments', { headers });
    expect(response.status()).toBe(200);

    const assessments = await response.json();
    expect(assessments).toBeDefined();
});
