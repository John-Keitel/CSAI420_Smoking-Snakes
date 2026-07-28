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
