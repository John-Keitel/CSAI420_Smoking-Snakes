import { z } from 'zod';

const NAME_MAX_LENGTH = 128;
const NAME_MAX_WORDS = 5;

/** Matches "First Last" / "First Middle Last" style input: letters per word, 2+ words. */
const PLAUSIBLE_NAME_PATTERN = /^\p{L}[\p{L}'’.-]*(\s+\p{L}[\p{L}'’.-]*)+$/u;

/** Crude, case-insensitive backstop against prompt-injection-style replies. */
const SUSPICIOUS_NAME_PATTERN = /\b(ignore|disregard|system prompt|you are|act as)\b/i;

/**
 * Guardrail for the COLLECT_NAME node (SCRUM-102). Used both to re-validate the
 * model's structured extraction and as the sole check on the no-model fallback path.
 */
export const NameFieldSchema = z
    .string()
    .trim()
    .min(2, 'That name is too short.')
    .max(NAME_MAX_LENGTH, 'That name is too long.')
    .refine((value) => !value.includes('@'), 'That looks like an email address, not a name.')
    .refine((value) => !/\d/.test(value), 'A name should not contain numbers.')
    .refine((value) => !SUSPICIOUS_NAME_PATTERN.test(value), 'That does not look like a name.')
    .refine((value) => PLAUSIBLE_NAME_PATTERN.test(value), 'That does not look like a first and last name.')
    .refine((value) => value.split(/\s+/).length <= NAME_MAX_WORDS, 'That name looks unusually long.');

// Matches User.email's @db.VarChar(128) in prisma/schema.prisma, so a collected
// address won't later fail to persist once EPIC 14 wires this up to registration.
const EMAIL_MAX_LENGTH = 128;

/**
 * Guardrail for the COLLECT_EMAIL node (SCRUM-103). Used both to re-validate the
 * model's structured extraction and as the sole check on the no-model fallback path.
 * Callers are expected to trim the candidate before parsing — z.email()'s own format
 * check runs before any chained check, so untrimmed whitespace would fail it first.
 */
export const EmailFieldSchema = z.email('That does not look like a valid email address.').max(EMAIL_MAX_LENGTH, 'That email address is too long.');

const DOB_MAX_AGE_YEARS = 120;

function yearsAgo(years: number): Date {
    const date = new Date();
    date.setFullYear(date.getFullYear() - years);
    return date;
}

function toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

/**
 * Guardrail for the COLLECT_DOB node (SCRUM-104). z.coerce.date() already rejects
 * unparseable input (Invalid Date); this adds future-date and implausible-age
 * bounds, then normalizes to an ISO 8601 date string for OnboardingState.collectedDob.
 */
export const DobFieldSchema = z.coerce
    .date()
    .refine((date) => date.getTime() <= Date.now(), 'That date of birth is in the future.')
    .refine((date) => date.getTime() >= yearsAgo(DOB_MAX_AGE_YEARS).getTime(), 'That date of birth seems implausibly long ago.')
    .transform(toIsoDate);
