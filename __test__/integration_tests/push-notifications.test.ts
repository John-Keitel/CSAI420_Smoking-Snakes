import 'dotenv/config';

import { beforeAll, describe, expect, it } from 'vitest';

const configuredApiUrl = process.env.API_URL;

if (!configuredApiUrl) {
    throw new Error('API_URL is required. Set it to the deployed or local Next.js API under test.');
}

const apiUrl = new URL(configuredApiUrl);
if (apiUrl.hostname === 'stedi.me' || apiUrl.hostname.endsWith('.stedi.me')) {
    throw new Error(`API_URL must point to this project, not the legacy STEDI API: ${apiUrl.origin}`);
}

// The legacy session validator (validateSureStepsSession) only requires a
// non-empty `suresteps.session.token` header, so any non-empty value
// authenticates the register endpoint.
const sessionToken = 'integration-test-session-token';
const sessionHeaders: Record<string, string> = { 'suresteps.session.token': sessionToken };

const stamp = Date.now();
const testUser = {
    email: `push_test_${stamp}@example.com`,
    phone: '+18015550100',
    firstName: 'Push',
    lastName: 'Tester',
    dateOfBirth: '2000-01-01',
    password: 'P@ssword123',
};

// One valid Expo token reused across the happy-path + upsert cases.
const pushToken = `ExponentPushToken[integration-${stamp}]`;

let userId: string;

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
    return fetch(new URL(path, apiUrl), init);
}

async function registerToken(body: Record<string, unknown>, headers: Record<string, string> = sessionHeaders): Promise<Response> {
    return apiFetch('/api/notifications/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
    });
}

beforeAll(async () => {
    // The register endpoint validates userId against this project's own users
    // table, so we create a real user through /auth/signup (which returns the
    // new user's id) rather than the legacy STEDI proxy.
    const response = await apiFetch('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: testUser.email,
            phone: testUser.phone,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            dateOfBirth: testUser.dateOfBirth,
            password: testUser.password,
            termsAccepted: true,
            privacyAccepted: true,
            cookiesAccepted: true,
            textMessagesAccepted: true,
        }),
    });

    if (response.status !== 201) {
        throw new Error(`Failed to create integration-test user: ${response.status} ${await response.text()}`);
    }

    const created = (await response.json()) as { id: string };
    userId = created.id;
});

describe('push notification registration flow', () => {
    it('registers a new Expo push token and persists it as active', async () => {
        const response = await registerToken({
            token: pushToken,
            userId,
            deviceName: 'Integration Phone',
            platform: 'ios',
        });
        const body = await response.json();

        expect(response.status, JSON.stringify(body)).toBe(201);
        expect(body).toMatchObject({
            token: pushToken,
            userId,
            platform: 'ios',
            isActive: true,
        });
        expect(body.id).toBeTruthy();
    });

    it('upserts the same token in place instead of creating a duplicate', async () => {
        // First call establishes / finds the row.
        const first = await registerToken({ token: pushToken, userId, platform: 'ios' });
        const firstBody = await first.json();
        expect(first.status, JSON.stringify(firstBody)).toBe(201);

        // Re-registering the same token returns the SAME row id (upsert, not a new
        // insert) and keeps it active — proof it was persisted and updated in place.
        const second = await registerToken({ token: pushToken, userId, platform: 'android' });
        const secondBody = await second.json();

        expect(second.status, JSON.stringify(secondBody)).toBe(201);
        expect(secondBody.id).toBe(firstBody.id);
        expect(secondBody.isActive).toBe(true);
        expect(secondBody.platform).toBe('android');
    });

    it('rejects an invalid Expo push token with 422', async () => {
        const response = await registerToken({ token: 'not-an-expo-token', userId });

        expect(response.status).toBe(422);
    });

    it('rejects a request without a session token with 401', async () => {
        const response = await registerToken({ token: pushToken, userId }, {});

        expect(response.status).toBe(401);
    });

    it('rejects registration for a non-existent user with 404', async () => {
        const response = await registerToken({
            token: `ExponentPushToken[ghost-${stamp}]`,
            userId: 'clghostuser0000000000000000',
        });

        expect(response.status).toBe(404);
    });
});
