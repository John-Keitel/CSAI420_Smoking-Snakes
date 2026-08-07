import { describe, expect, it } from 'vitest';

import { stripHtml } from '@/lib/validation';

describe('stripHtml', () => {
    it('removes script tags from escalated questions', () => {
        const sanitized = stripHtml('<script>alert("xss")</script>This is a test question');

        expect(sanitized).not.toContain('<script>');
        expect(sanitized).toContain('This is a test question');
    });

    it('removes doctype declarations carrying an XXE entity', () => {
        // The declaration wraps a bracketed internal subset, so a lone `<[^>]*>`
        // pass would stop at the first `>` and leave `]>` behind.
        const sanitized = stripHtml('<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>');

        expect(sanitized).not.toContain('<!DOCTYPE');
        expect(sanitized).not.toContain('<!ENTITY');
        expect(sanitized).not.toContain(']>');
    });

    it('strips html comments', () => {
        expect(stripHtml('before<!-- hidden -->after')).toBe('before after');
    });

    it('collapses whitespace and control characters', () => {
        expect(stripHtml('  spaced\n\tout  ')).toBe('spaced out');
    });

    it('leaves ordinary prose untouched', () => {
        const question = 'I have knee pain after my balance test. What should I do?';
        expect(stripHtml(question)).toBe(question);
    });
});
