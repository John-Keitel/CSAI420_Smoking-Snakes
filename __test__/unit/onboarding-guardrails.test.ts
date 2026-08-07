import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
    getAppLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { detectOffTopicOrClinicalRequest } from '@/lib/onboarding/guardrails';

describe('detectOffTopicOrClinicalRequest (SCRUM-108)', () => {
    it('redirects a clinical-advice request without echoing any medical advice', () => {
        const result = detectOffTopicOrClinicalRequest('what dosage of ibuprofen should I take for my headache?');

        expect(result).not.toBeNull();
        expect(result?.message).not.toMatch(/\bmg\b|\bibuprofen\b|\btake\b \d/i);
        expect(result?.message.toLowerCase()).toContain('medical advice');
    });

    it('redirects a request for a diagnosis', () => {
        const result = detectOffTopicOrClinicalRequest('Can you diagnose my chest pain?');

        expect(result).not.toBeNull();
        expect(result?.message.toLowerCase()).toContain('medical advice');
    });

    it('redirects a generic off-topic question', () => {
        const result = detectOffTopicOrClinicalRequest("What's the weather like today?");

        expect(result).not.toBeNull();
        expect(result?.message.toLowerCase()).toContain('signing up');
    });

    it('does not flag a plausible full name', () => {
        expect(detectOffTopicOrClinicalRequest('John Smith')).toBeNull();
    });

    it('does not flag a plausible email address', () => {
        expect(detectOffTopicOrClinicalRequest('john@example.com')).toBeNull();
    });

    it('does not flag a plausible date of birth', () => {
        expect(detectOffTopicOrClinicalRequest('1996-05-21')).toBeNull();
    });

    it('flags a password containing "?" as off-topic by default', () => {
        expect(detectOffTopicOrClinicalRequest('Sup3rSecret?')).not.toBeNull();
    });

    it('does not flag a password containing "?" when treatQuestionMarkAsOffTopic is false', () => {
        expect(detectOffTopicOrClinicalRequest('Sup3rSecret?', { treatQuestionMarkAsOffTopic: false })).toBeNull();
    });

    it('still flags a clinical-advice request in a password reply even when the question-mark check is disabled', () => {
        const result = detectOffTopicOrClinicalRequest('what dosage should I take', { treatQuestionMarkAsOffTopic: false });

        expect(result).not.toBeNull();
        expect(result?.message.toLowerCase()).toContain('medical advice');
    });
});
