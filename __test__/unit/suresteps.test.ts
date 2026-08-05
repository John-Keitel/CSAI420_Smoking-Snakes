import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { validateSureStepsSession } from '@/lib/auth/suresteps';

const now = Math.floor(Date.now() / 1000);
const secret = new TextEncoder().encode('unit-test-secret');

async function makeToken(payload: Record<string, unknown>, expSeconds?: number): Promise<string> {
    let jwt = new SignJWT(payload).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).sign(secret);
    if (expSeconds !== undefined) {
        jwt = new SignJWT(payload).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setExpirationTime(expSeconds).sign(secret);
    }
    return jwt;
}

function makeRequest(headers: Record<string, string>): NextRequest {
    return new NextRequest('http://localhost/api/notifications/register', { headers });
}

describe('validateSureStepsSession', () => {
    it('rejects a request without a session token header', () => {
        const result = validateSureStepsSession(makeRequest({}));

        expect(result).toEqual({ ok: false, reason: 'Missing suresteps.session.token header' });
    });

    it('rejects a whitespace-only session token', () => {
        // Headers normalizes (trims) values, so whitespace-only arrives as missing.
        const result = validateSureStepsSession(makeRequest({ 'suresteps.session.token': '   ' }));

        expect(result).toEqual({ ok: false, reason: 'Missing suresteps.session.token header' });
    });

    it('rejects a token whose exp claim is in the past', async () => {
        const token = await makeToken({ sub: 'user-1' }, now - 3600);

        const result = validateSureStepsSession(makeRequest({ 'suresteps.session.token': token }));

        expect(result).toEqual({ ok: false, reason: 'Session token expired' });
    });

    it('rejects a token whose exp claim is exactly now (boundary)', async () => {
        const token = await makeToken({ sub: 'user-1' }, now);

        const result = validateSureStepsSession(makeRequest({ 'suresteps.session.token': token }));

        expect(result).toEqual({ ok: false, reason: 'Session token expired' });
    });

    it('accepts a token whose exp claim is in the future', async () => {
        const token = await makeToken({ sub: 'user-1' }, now + 3600);

        const result = validateSureStepsSession(makeRequest({ 'suresteps.session.token': token }));

        expect(result).toMatchObject({ ok: true, user: { id: 'user-1' } });
    });

    it('accepts a non-JWT token (no exp claim) as before', () => {
        const result = validateSureStepsSession(makeRequest({ 'suresteps.session.token': 'integration-test-session-token' }));

        expect(result.ok).toBe(true);
    });

    it('treats a non-numeric exp claim as absent', async () => {
        const token = await makeToken({ sub: 'user-1', exp: 'not-a-number' });

        const result = validateSureStepsSession(makeRequest({ 'suresteps.session.token': token }));

        expect(result.ok).toBe(true);
    });

    it('prefers the expired reason over a header-provided identity', async () => {
        const token = await makeToken({ sub: 'user-1' }, now - 3600);

        const result = validateSureStepsSession(
            makeRequest({
                'suresteps.session.token': token,
                'suresteps.user.id': 'user-from-header',
            })
        );

        expect(result).toEqual({ ok: false, reason: 'Session token expired' });
    });
});
