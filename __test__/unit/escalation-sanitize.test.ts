import { describe, expect, it } from 'vitest';

import { sanitizeText } from '@/lib/escalation/sanitize';

describe('sanitizeText', () => {
    it('strips script tags and their content', () => {
        const result = sanitizeText('<script>alert("xss")</script>This is a test question');

        expect(result).not.toContain('<script>');
        expect(result).toBe('This is a test question');
    });

    it('strips DOCTYPE/entity declarations', () => {
        const result = sanitizeText('<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>');

        expect(result).not.toContain('<!DOCTYPE');
    });

    it('leaves plain text untouched', () => {
        expect(sanitizeText('The app keeps crashing')).toBe('The app keeps crashing');
    });
});
