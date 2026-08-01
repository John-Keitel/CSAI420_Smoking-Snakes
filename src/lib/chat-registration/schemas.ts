import { z } from 'zod';

const CHAT_PASSWORD_MIN_LENGTH = 8;
const CHAT_PASSWORD_MAX_LENGTH = 128;

/**
 * Distinct on purpose from src/lib/onboarding/schemas.ts's PasswordFieldSchema: that one only
 * requires a letter + a digit, loose enough to re-prompt mid-conversation without being overly
 * strict on a single turn. This endpoint receives a password the AI assistant already finished
 * collecting, so it enforces the same strength bar as SignUpSchema.password (src/lib/schemas.ts):
 * upper + lower + digit + special character, all required.
 */
export const ChatAssistedPasswordSchema = z
    .string()
    .min(CHAT_PASSWORD_MIN_LENGTH, `password must be at least ${CHAT_PASSWORD_MIN_LENGTH} characters long`)
    .max(CHAT_PASSWORD_MAX_LENGTH, `password must be at most ${CHAT_PASSWORD_MAX_LENGTH} characters long`)
    .regex(/[A-Z]/, 'password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'password must contain at least one special character');

// Matches User.firstName/lastName's @db.VarChar(64) in prisma/schema.prisma.
const PERSON_NAME_MAX_LENGTH = 64;

// Unicode-aware: a single word ("ChatBot") or several ("José María", "García-López") are both
// valid first/last names, so — unlike onboarding's combined-name NameFieldSchema — this does not
// require 2+ words. Letters (any language, via \p{L}) and digits are allowed (e.g. "User0" from
// a generated test fixture); the rest of the allowed set is limited to apostrophe/period/hyphen/
// space as name connectors.
//
// This same allowlist is this endpoint's XSS/SQLi defense (see route.ts's sanitize-vs-reject
// note): a payload like "<script>alert(1)</script>" or "DROP TABLE users;--" fails to match
// (angle brackets, semicolons, etc. aren't in the allowed set) and the whole request is rejected
// with 400 rather than silently rewritten.
const PERSON_NAME_PATTERN = /^\p{L}[\p{L}\p{N}'’.\- ]*$/u;

function personNameSchema(fieldLabel: string) {
    return z
        .string()
        .trim()
        .min(1, `${fieldLabel} is required`)
        .max(PERSON_NAME_MAX_LENGTH, `${fieldLabel} is too long`)
        .regex(PERSON_NAME_PATTERN, `${fieldLabel} contains characters that aren't allowed`);
}

// Lenient on purpose: unlike SignUpSchema's required E.164 phone, phone is optional here and the
// AI assistant may pass through whatever format the user typed conversationally (e.g. no leading
// "+", as in setup.js's testData.phone).
const PHONE_PATTERN = /^\+?[\d\s\-()]+$/;

export const ChatAssistedUserDataSchema = z.object({
    email: z.email(),
    password: ChatAssistedPasswordSchema,
    birthDate: z.coerce.date(),
    phone: z.string().regex(PHONE_PATTERN, 'invalid phone number format').optional(),
    firstName: personNameSchema('firstName'),
    lastName: personNameSchema('lastName'),
});

const ConversationLogEntrySchema = z.object({
    role: z.enum(['user', 'assistant']),
    message: z.string(),
});

// Chat metadata fields (conversationLog, accessibilityMode, locale, sessionMetrics) are all
// optional and loosely typed — none of them gate registration, they're accepted so the AI
// assistant can forward whatever context it has without the request being rejected for it.
export const ChatAssistedRegistrationSchema = z.object({
    userData: ChatAssistedUserDataSchema,
    chatSessionId: z.string().min(1),
    lastActivity: z.string().optional(),
    conversationLog: z.array(ConversationLogEntrySchema).optional(),
    accessibilityMode: z.string().optional(),
    locale: z.string().optional(),
    sessionMetrics: z.record(z.string(), z.unknown()).optional(),
});

export type ChatAssistedRegistrationInput = z.infer<typeof ChatAssistedRegistrationSchema>;
