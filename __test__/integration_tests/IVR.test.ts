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

const testData = {
    email: 'test_user@example.com',
    region: 'US',
    phone: '8014567890',
    birthDate: '2000-01-01',
    password: 'P@ssword123',
};

const stediBaseUrl = new URL(process.env.STEDI_API_BASE_URL ?? 'https://dev.stedi.me');

let token: string;

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
    return fetch(new URL(path, apiUrl), init);
}

async function createUser(): Promise<void> {
    const timestamp = Date.now();
    const response = await apiFetch('/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userName: testData.email,
            email: testData.email,
            phone: testData.phone,
            region: testData.region,
            birthDate: testData.birthDate,
            password: testData.password,
            verifyPassword: testData.password,
            agreedToTermsOfUseDate: timestamp,
            agreedToCookiePolicyDate: timestamp,
            agreedToPrivacyPolicyDate: timestamp,
            agreedToTextMessageDate: timestamp,
        }),
    });

    if (response.status !== 200 && response.status !== 409) {
        throw new Error(`Failed to create integration-test user: ${response.status} ${await response.text()}`);
    }
}

async function login(): Promise<string> {
    const response = await fetch(new URL('/login', stediBaseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userName: testData.email,
            password: testData.password,
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to authenticate integration-test user against STEDI: ${response.status} ${await response.text()}`);
    }

    const sessionToken = (await response.text()).trim();
    if (!sessionToken) {
        throw new Error('STEDI returned an empty session token.');
    }

    return sessionToken;
}

async function createCustomer(): Promise<void> {
    const response = await apiFetch('/customer', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'suresteps.session.token': token,
        },
        body: JSON.stringify({
            customerName: 'Test User',
            email: testData.email,
            region: testData.region,
            phone: testData.phone,
            whatsAppPhone: testData.phone,
            birthDay: testData.birthDate,
        }),
    });

    if (response.status !== 200 && response.status !== 409) {
        throw new Error(`Failed to create integration-test customer: ${response.status} ${await response.text()}`);
    }
}

async function saveSteps(stepDuration: number, count: number): Promise<Response> {
    const stopTime = Date.now();

    return apiFetch('/rapidsteptest', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'suresteps.session.token': token,
        },
        body: JSON.stringify({
            customer: testData.email,
            startTime: stopTime - stepDuration * count,
            stepPoints: Array(count).fill(stepDuration),
            stopTime,
            testTime: stepDuration * count,
            deviceId: '000',
            totalSteps: count,
        }),
    });
}

beforeAll(async () => {
    await createUser();
    token = await login();
    await createCustomer();
});

describe('IVR pass-through API', () => {
    it('saves step data from an IoT device', async () => {
        const response = await saveSteps(100, 1);

        expect(response.status).toBe(200);
        expect(await response.text()).toBe('Saved');
    });

    it('calculates a risk score after receiving step data', async () => {
        for (const duration of [200, 200, 100, 100]) {
            const response = await saveSteps(duration, 30);
            expect(response.status).toBe(200);
        }

        const response = await apiFetch(`/riskscore/${testData.email}`, {
            headers: {
                'suresteps.session.token': token,
            },
        });
        const body = await response.text();

        expect(response.status, body).toBe(200);

        const result = JSON.parse(body) as { score: number };
        expect(result.score).toBeGreaterThan(0);
    });
});
