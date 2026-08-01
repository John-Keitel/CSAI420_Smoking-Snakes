import { describe, expect, it } from 'vitest';

import { ChatAssistedRegistrationSchema } from '@/lib/schemas/chat-assisted-registration.schema';
import { ContinueSessionSchema } from '@/lib/schemas/continue-session.schema';
import { RegistrationEscalationSchema } from '@/lib/schemas/registration-escalation.schema';
import { flattenZodErrors } from '@/lib/validation/week5-errors';

const validUserData = {
    userData: {
        email: 'valid.email@example.com',
        password: 'P@ssword123',
        birthDate: '2000-01-01',
        phone: '8014567890',
        firstName: 'ChatBot',
        lastName: 'TestUser',
    },
    chatSessionId: 'session_1234567890',
};

function parseChat(body: unknown) {
    const result = ChatAssistedRegistrationSchema.safeParse(body);
    if (result.success) {
        return { ok: true as const, data: result.data };
    }
    return { ok: false as const, errors: flattenZodErrors(result.error).errors };
}

describe('ChatAssistedRegistrationSchema', () => {
    it('accepts the Week 5 happy-path payload (CAT-01)', () => {
        const result = parseChat(validUserData);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.userData.email).toBe('valid.email@example.com');
            expect(result.data.userData.birthDate).toBeInstanceOf(Date);
        }
    });

    it('accepts a valid email and rejects the four invalid email forms (CAT-03)', () => {
        const invalidEmails = ['invalid-email', 'missing-at-symbol.com', '@missing-local-part.com', 'spaces in@email.com'];
        for (const email of invalidEmails) {
            const result = parseChat({ ...validUserData, userData: { ...validUserData.userData, email } });
            expect(result.ok).toBe(false);
        }
        expect(parseChat(validUserData).ok).toBe(true);
    });

    it('accepts the strong password and rejects the weak matrix with "password" in an error (CAT-04)', () => {
        const weakPasswords = ['weak', '12345678', 'NoNumbers!', 'nonumbers123'];
        for (const password of weakPasswords) {
            const result = parseChat({ ...validUserData, userData: { ...validUserData.userData, password } });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.errors.some((error) => error.toLowerCase().includes('password'))).toBe(true);
            }
        }
        expect(parseChat({ ...validUserData, userData: { ...validUserData.userData, password: 'Str0ngP@ssw0rd!' } }).ok).toBe(true);
    });

    it('rejects markup and SQL metacharacters in names (CAT-05)', () => {
        const maliciousFirstName = parseChat({
            ...validUserData,
            userData: { ...validUserData.userData, firstName: '<script>alert("xss")</script>' },
        });
        expect(maliciousFirstName.ok).toBe(false);

        const maliciousLastName = parseChat({
            ...validUserData,
            userData: { ...validUserData.userData, lastName: 'DROP TABLE users;--' },
        });
        expect(maliciousLastName.ok).toBe(false);
    });

    it('accepts international names unmodified (CAT-06)', () => {
        const result = parseChat({
            ...validUserData,
            userData: { ...validUserData.userData, firstName: 'José María', lastName: 'García-López' },
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.userData.firstName).toBe('José María');
            expect(result.data.userData.lastName).toBe('García-López');
        }
    });

    it('accepts accessibilityMode, locale, and sessionMetrics (CAT-07)', () => {
        const result = parseChat({
            ...validUserData,
            accessibilityMode: 'simplified_language',
            locale: 'es-ES',
            sessionMetrics: {
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                messageCount: 4,
                userSatisfaction: 'high',
            },
        });
        expect(result.ok).toBe(true);
    });

    it('rejects an invalid birthDate and missing required fields (CAT-02)', () => {
        const badBirthDate = parseChat({ ...validUserData, userData: { ...validUserData.userData, birthDate: 'invalid-date' } });
        expect(badBirthDate.ok).toBe(false);

        const missingFields = parseChat({ userData: { email: 'incomplete@example.com' }, chatSessionId: 'session_123' });
        expect(missingFields.ok).toBe(false);
    });

    it('rejects a body without userData (CAT-10 malformed body)', () => {
        const result = parseChat({ invalidField: 'x' });
        expect(result.ok).toBe(false);
        expect(result.ok || result.errors.length).toBeGreaterThan(0);
    });

    it('rejects a chatSessionId longer than 128 characters', () => {
        const result = parseChat({ ...validUserData, chatSessionId: 's'.repeat(129) });
        expect(result.ok).toBe(false);
    });

    it('accepts the Week 5 phone without a leading + and rejects short/alpha phones', () => {
        expect(parseChat(validUserData).ok).toBe(true);
        const shortPhone = parseChat({ ...validUserData, userData: { ...validUserData.userData, phone: '123' } });
        expect(shortPhone.ok).toBe(false);
        const alphaPhone = parseChat({ ...validUserData, userData: { ...validUserData.userData, phone: 'invalid-phone' } });
        expect(alphaPhone.ok).toBe(false);
    });
});

describe('RegistrationEscalationSchema', () => {
    const base = {
        phoneNumber: '8014567890',
        registrationData: { partialEmail: 'confused_user@' },
        chatSessionId: 'session_1234567890',
        aiResponse: 'Let me connect you with a support agent.',
        responsePreference: 'chat',
        conversationContext: [{ role: 'user', message: 'I need help' }],
    };

    it('accepts all three Week 5 issue types (ESC-01, ESC-02, ESC-03)', () => {
        for (const issueType of ['confusion_about_process', 'technical_difficulties', 'account_creation_failed']) {
            const result = RegistrationEscalationSchema.safeParse({ ...base, issueType });
            expect(result.success).toBe(true);
        }
    });

    it('rejects an unknown issueType, bad phone, missing chatSessionId, missing responsePreference (ESC-04)', () => {
        const unknownType = RegistrationEscalationSchema.safeParse({ ...base, issueType: 'unknown_issue_type' });
        expect(unknownType.success).toBe(false);

        const badPhone = RegistrationEscalationSchema.safeParse({
            ...base,
            issueType: 'confusion_about_process',
            phoneNumber: 'invalid-phone',
        });
        expect(badPhone.success).toBe(false);

        const { chatSessionId: _chatSessionId, ...withoutSession } = base;
        const missingSession = RegistrationEscalationSchema.safeParse({ ...withoutSession, issueType: 'confusion_about_process' });
        expect(missingSession.success).toBe(false);

        const { responsePreference: _responsePreference, ...withoutPreference } = base;
        const missingPreference = RegistrationEscalationSchema.safeParse({ ...withoutPreference, issueType: 'confusion_about_process' });
        expect(missingPreference.success).toBe(false);
    });
});

describe('ContinueSessionSchema', () => {
    it('accepts the Week 5 payload shape (SES-01)', () => {
        const result = ContinueSessionSchema.safeParse({
            chatSessionId: 'session_1',
            message: 'I need help signing up',
            context: 'initial_greeting',
        });
        expect(result.success).toBe(true);
    });

    it('accepts the second interaction step (SES-02)', () => {
        const result = ContinueSessionSchema.safeParse({ chatSessionId: 'session_1', message: 'John Doe', context: 'name_provided' });
        expect(result.success).toBe(true);
    });

    it('rejects a missing message and an unknown context', () => {
        const noMessage = ContinueSessionSchema.safeParse({ chatSessionId: 'session_1', context: 'initial_greeting' });
        expect(noMessage.success).toBe(false);

        const badContext = ContinueSessionSchema.safeParse({ chatSessionId: 'session_1', message: 'hi', context: 'unknown_step' });
        expect(badContext.success).toBe(false);
    });
});

describe('flattenZodErrors', () => {
    it('returns a flat, non-empty errors array (never an object)', () => {
        const result = ChatAssistedRegistrationSchema.safeParse({ invalidField: 'x' });
        expect(result.success).toBe(false);
        if (!result.success) {
            const flattened = flattenZodErrors(result.error);
            expect(flattened.errors).toBeInstanceOf(Array);
            expect(flattened.errors.length).toBeGreaterThan(0);
        }
    });

    it('includes the field path so password issues contain the word "password"', () => {
        const result = ChatAssistedRegistrationSchema.safeParse({
            userData: { ...validUserData.userData, password: 'weak' },
            chatSessionId: 'session_1',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const { errors } = flattenZodErrors(result.error);
            expect(errors.some((error) => error.toLowerCase().includes('password'))).toBe(true);
        }
    });
});
