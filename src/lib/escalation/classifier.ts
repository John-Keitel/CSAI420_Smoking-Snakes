import type { EscalationCategory, EscalationPriority } from '@/generated/prisma/client';

export type EscalationTriage = {
    priority: EscalationPriority;
    category: EscalationCategory;
};

/**
 * Support-tooling vocabulary. Checked before the clinical vocabulary because a
 * patient describing an app defect often mentions the feature they were looking
 * at ("my balance scores"), and that context must not read as clinical.
 *
 * Deliberately excluded: bare "connect" and "diagnose", which appear in the
 * assistant's own hand-off phrasing for every category.
 */
const TECHNICAL_KEYWORDS = [
    'app',
    'application',
    'bluetooth',
    'browser',
    'bug',
    'button',
    'crash',
    'crashed',
    'crashing',
    'error',
    'freeze',
    'frozen',
    'glitch',
    'install',
    'loading',
    'login',
    'logout',
    'offline',
    'password',
    'reinstall',
    'screen',
    'software',
    'sync',
    'syncing',
    'technical',
    'troubleshoot',
    'uninstall',
    'upgrade',
    'website',
    'wifi',
] as const;

/** Clinical vocabulary. A match escalates to HIGH priority for coach triage. */
const MEDICAL_KEYWORDS = [
    'ache',
    'aching',
    'bleeding',
    'blood',
    'breathe',
    'breathing',
    'chest',
    'dizziness',
    'dizzy',
    'emergency',
    'faint',
    'fainted',
    'fall',
    'fell',
    'fracture',
    'healthcare',
    'heart',
    'hurt',
    'hurts',
    'injured',
    'injury',
    'medical',
    'medication',
    'medications',
    'nausea',
    'numb',
    'numbness',
    'pain',
    'painful',
    'prescribe',
    'prescription',
    'sprain',
    'stroke',
    'swelling',
    'swollen',
    'symptom',
    'symptoms',
] as const;

function containsAny(text: string, keywords: readonly string[]): boolean {
    return keywords.some((keyword) => new RegExp(`\\b${keyword}\\b`, 'i').test(text));
}

/**
 * Route an escalation to a queue lane. Both the patient question and the
 * assistant's reply are considered, since the reply usually names the domain it
 * declined to handle.
 */
export function classifyEscalation(question: string, aiResponse: string): EscalationTriage {
    const text = `${question} ${aiResponse}`;

    if (containsAny(text, TECHNICAL_KEYWORDS)) {
        return { priority: 'MEDIUM', category: 'TECHNICAL' };
    }

    if (containsAny(text, MEDICAL_KEYWORDS)) {
        return { priority: 'HIGH', category: 'MEDICAL' };
    }

    return { priority: 'MEDIUM', category: 'GENERAL' };
}
