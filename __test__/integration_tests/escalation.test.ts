import 'dotenv/config';

import { afterAll, describe, expect, it } from 'vitest';

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
// authenticates these endpoints.
const sessionToken = 'integration-test-session-token';
const sessionHeaders: Record<string, string> = { 'suresteps.session.token': sessionToken };

const stamp = Date.now();

const scenarios = {
    medical: {
        phoneNumber: '+1234567890',
        question: "I'm having chest pain after my balance test, should I be worried?",
        aiResponse: 'I cannot provide medical advice about chest pain. Let me connect you with a healthcare professional.',
        responsePreference: 'call',
        waitingForResponse: true,
        sessionId: `session_medical_${stamp}`,
        userId: `user_medical_${stamp}`,
    },
    technical: {
        phoneNumber: '+1987654321',
        question: 'The app keeps crashing when I try to view my balance scores',
        aiResponse: "I'm unable to diagnose technical issues with the app. Let me connect you with our technical support team.",
        responsePreference: 'chat',
        waitingForResponse: false,
        sessionId: `session_tech_${stamp}`,
        userId: `user_tech_${stamp}`,
    },
} as const;

// Every escalation created here is removed in afterAll so repeated runs against a
// shared deployment do not accumulate rows.
const createdEscalations: string[] = [];

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
    return fetch(new URL(path, apiUrl), init);
}

async function escalate(payload: unknown, headers: Record<string, string> = sessionHeaders): Promise<Response> {
    return apiFetch('/escalate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    });
}

async function escalateAndTrack(payload: Record<string, unknown>) {
    const response = await escalate({ ...payload, timestamp: new Date().toISOString() });
    const body = await response.json();

    if (response.status === 200 && body.escalationId) {
        createdEscalations.push(body.escalationId);
    }

    return { response, body };
}

async function getEscalation(escalationId: string, headers: Record<string, string> = sessionHeaders): Promise<Response> {
    return apiFetch(`/escalation/${escalationId}`, { headers });
}

afterAll(async () => {
    for (const escalationId of createdEscalations) {
        await apiFetch(`/escalation/${escalationId}`, { method: 'DELETE', headers: sessionHeaders }).catch(() => undefined);
    }
});

describe('POST /escalate-question', () => {
    it('escalates a medical question and returns the confirmation contract', async () => {
        const { response, body } = await escalateAndTrack(scenarios.medical);

        expect(response.status, JSON.stringify(body)).toBe(200);
        expect(body.status).toBe('escalated');
        expect(body.escalationId).toMatch(/^esc_[a-zA-Z0-9]+$/);
        expect(body.estimatedResponseTime).toBeTruthy();
        expect(body.message).toMatch(/forwarded to a healthcare coach/i);
    });

    it('escalates a technical support question', async () => {
        const { response, body } = await escalateAndTrack(scenarios.technical);

        expect(response.status, JSON.stringify(body)).toBe(200);
        expect(body.status).toBe('escalated');
        expect(body.escalationId).toMatch(/^esc_[a-zA-Z0-9]+$/);
    });

    it('rejects a payload missing required fields', async () => {
        const response = await escalate({ phoneNumber: '+1234567890' });
        expect(response.status).toBe(400);
    });

    it('rejects a phone number that is not E.164', async () => {
        const response = await escalate({ ...scenarios.medical, phoneNumber: 'invalid-phone-number' });
        expect(response.status).toBe(400);
    });

    it('rejects an unsupported response preference', async () => {
        const response = await escalate({ ...scenarios.medical, responsePreference: 'invalid-preference' });
        expect(response.status).toBe(400);
    });

    it('requires authentication', async () => {
        const response = await escalate(scenarios.medical, {});
        expect(response.status).toBe(401);
    });

    it('rejects malformed JSON and empty bodies', async () => {
        await expect(escalate('invalid-json-{').then((r) => r.status)).resolves.toBe(400);
        await expect(escalate('').then((r) => r.status)).resolves.toBe(400);
    });

    it('handles concurrent escalations without failing', async () => {
        const results = await Promise.all(
            Array.from({ length: 5 }, (_, index) =>
                escalateAndTrack({
                    ...scenarios.medical,
                    sessionId: `session_bulk_${stamp}_${index}`,
                    question: `Bulk test question ${index}`,
                })
            )
        );

        for (const { response } of results) {
            expect([200, 429]).toContain(response.status);
        }
    });
});

describe('GET /escalation/:escalationId', () => {
    it('returns the stored escalation with triage metadata', async () => {
        const { body: created } = await escalateAndTrack(scenarios.medical);

        const response = await getEscalation(created.escalationId);
        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body.escalationId).toBe(created.escalationId);
        expect(['pending', 'assigned', 'resolved']).toContain(body.status);
        expect(body.originalQuestion).toBeTruthy();
        expect(body.phoneNumber).toBe(scenarios.medical.phoneNumber);
        expect(body.responsePreference).toBe('call');
        expect(body.escalationTimestamp).toBeTruthy();
        expect(body.priority).toBeTruthy();
        expect(body.category).toBeTruthy();
    });

    it('classifies a medical question as high priority', async () => {
        const { body: created } = await escalateAndTrack(scenarios.medical);
        const body = await (await getEscalation(created.escalationId)).json();

        expect(body.priority).toBe('high');
        expect(body.category).toBe('medical');
    });

    it('classifies an app defect as a lower-priority technical issue', async () => {
        const { body: created } = await escalateAndTrack(scenarios.technical);
        const body = await (await getEscalation(created.escalationId)).json();

        expect(['medium', 'low']).toContain(body.priority);
        expect(body.category).toBe('technical');
    });

    it('returns 404 for an unknown escalation', async () => {
        const response = await getEscalation('esc_nonexistent123');
        expect(response.status).toBe(404);
    });

    it('requires authentication', async () => {
        const response = await getEscalation('esc_test123', {});
        expect(response.status).toBe(401);
    });

    it('stores escalated free text with markup stripped', async () => {
        const { response, body: created } = await escalateAndTrack({
            ...scenarios.medical,
            question: '<script>alert("xss")</script>This is a test question',
            aiResponse: '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
        });
        expect(response.status).toBe(200);

        const body = await (await getEscalation(created.escalationId)).json();
        expect(body.originalQuestion).not.toContain('<script>');
        expect(body.aiResponse).not.toContain('<!DOCTYPE');
    });
});
