import { jwtVerify } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env-vars', () => ({
    ENV_VARS: { AUTH_SECRET: 'test-auth-secret' },
}));

import { UserRegisterChatSchema } from '@/lib/schemas/user-registration.schema';
import { sanitizeInputString } from '@/lib/sanitization';
import { signUserToken } from '@/lib/auth';

describe('user registration security utilities', () => {
    afterEach(() => {
        vi.useRealTimers();
        delete process.env.AUTH_SECRET;
    });

    it('sanitizes script tags and injection characters from user-facing strings', () => {
        const rawName = "<script>alert('x')</script>  Maria ; DROP TABLE users --";
        const sanitized = sanitizeInputString(rawName);

        expect(sanitized).toBe('Maria DROP TABLE users');

        const parsed = UserRegisterChatSchema.parse({
            name: rawName,
            email: '  PATIENT@STEDI.COM ',
            password: 'safe pass 12345',
            dob: '2026-07-01',
        });

        expect(parsed.name).toBe('Maria DROP TABLE users');
        expect(parsed.email).toBe('patient@stedi.com');
    });

    it('signs JWT with userId/email payload and 7 day expiration', async () => {
        process.env.AUTH_SECRET = 'test-auth-secret';

        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-01T00:00:00.000Z'));

        const token = await signUserToken({ userId: 'user-123', email: 'patient@stedi.com' });
        const { payload: decoded } = await jwtVerify(token, new TextEncoder().encode('test-auth-secret'));

        expect(decoded.userId).toBe('user-123');
        expect(decoded.email).toBe('patient@stedi.com');
        expect(decoded.iat).toBeDefined();
        expect(decoded.exp).toBeDefined();

        const ttlInSeconds = (decoded.exp as number) - (decoded.iat as number);
        expect(ttlInSeconds).toBe(7 * 24 * 60 * 60);
    });
});
