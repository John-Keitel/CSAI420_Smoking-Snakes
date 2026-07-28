import type { EscalationPriority } from '@/generated/prisma/client';

export type EscalationCategory = 'medical' | 'technical' | 'general';

export type EscalationClassification = {
    priority: EscalationPriority;
    category: EscalationCategory;
};

const MEDICAL_KEYWORDS =
    /\b(pain|hurt|hurting|emergency|chest|dizzy|dizziness|fell|falling|injury|injured|bleeding|symptom|medical|ache|aching|numbness|breathe|breathing|urgent)\b/i;

const TECHNICAL_KEYWORDS = /\b(app|crash|crashing|crashed|bug|glitch|technical|freeze|frozen|sync|login|device|sensor|error)\b/i;

/**
 * Keyword-based triage: medical language takes priority over technical
 * language, everything else is a medium-priority general inquiry.
 */
export function classifyEscalation(question: string, aiResponse: string): EscalationClassification {
    const haystack = `${question} ${aiResponse}`;

    if (MEDICAL_KEYWORDS.test(haystack)) {
        return { priority: 'high', category: 'medical' };
    }

    if (TECHNICAL_KEYWORDS.test(haystack)) {
        return { priority: 'medium', category: 'technical' };
    }

    return { priority: 'medium', category: 'general' };
}
