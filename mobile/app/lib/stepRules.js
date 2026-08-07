import { Platform } from 'react-native';

/**
 * The conversation steps, in the order the server advances through them.
 * Mirrors CHAT_STEPS in src/app/chat/continue-session/route.ts.
 */
export const CHAT_STEPS = [
    'initial_greeting',
    'name_provided',
    'email_collection',
    'phone_collection',
    'birth_date_collection',
    'password_collection',
    'completion',
];

export const INITIAL_CHAT_STEP = 'initial_greeting';
export const FINAL_CHAT_STEP = 'completion';

/**
 * Which field a message fills is decided by the step the session is in WHEN THE
 * MESSAGE IS SENT - not by the step returned in the response. The server's
 * advanceChat() replies with the prompt for the current step and then advances,
 * so the answer to "What's your name?" arrives while the step is already
 * `name_provided`. See design.md for the normative table.
 *
 * `initial_greeting` and `completion` map to nothing: the first is a throwaway
 * opener needed only because `message` is required, the last collects nothing.
 */
const FIELD_BY_STEP = {
    name_provided: 'name',
    email_collection: 'email',
    phone_collection: 'phone',
    birth_date_collection: 'birthDate',
    password_collection: 'password',
};

/**
 * @param {string} step
 * @returns {string|null} The accumulator key this step's message fills, or null.
 */
export function fieldForStep(step) {
    return FIELD_BY_STEP[step] ?? null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?\d{7,15}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FORBIDDEN_NAME_CHARACTERS = /[<>;]/;
const MAX_NAME_PART_LENGTH = 64;

const valid = () => ({ valid: true, error: null });
const invalid = (error) => ({ valid: false, error });

/**
 * Splits one spoken name into the two fields the API requires.
 *
 * `/user/chat-assisted` requires firstName AND lastName, each min(1) after trim,
 * so a one-word answer would otherwise be rejected with a 400 at the very end of
 * the conversation. Defaults the missing part to 'User', matching the splitName()
 * precedent in src/app/api/user/register-chat/route.ts.
 *
 * @param {string} value
 * @returns {{firstName: string, lastName: string}}
 */
export function splitName(value) {
    const normalized = String(value ?? '')
        .trim()
        .replace(/\s+/g, ' ');
    const [firstPart, ...rest] = normalized.split(' ');

    return {
        firstName: firstPart || 'User',
        lastName: rest.join(' ') || 'User',
    };
}

function validateName(value) {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
        return invalid('Please tell us your name.');
    }

    if (FORBIDDEN_NAME_CHARACTERS.test(trimmed)) {
        return invalid('Your name cannot contain <, > or ;.');
    }

    if (trimmed.includes('--')) {
        return invalid('Your name cannot contain --.');
    }

    const { firstName, lastName } = splitName(trimmed);

    if (firstName.length > MAX_NAME_PART_LENGTH || lastName.length > MAX_NAME_PART_LENGTH) {
        return invalid(`Each part of your name must be ${MAX_NAME_PART_LENGTH} characters or fewer.`);
    }

    return valid();
}

function validateEmail(value) {
    return EMAIL_PATTERN.test(value.trim()) ? valid() : invalid('That does not look like a valid email address.');
}

function validatePhone(value) {
    return PHONE_PATTERN.test(value.trim()) ? valid() : invalid('Enter 7 to 15 digits, optionally starting with +.');
}

function isRealCalendarDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validateBirthDate(value) {
    const trimmed = value.trim();

    if (!ISO_DATE_PATTERN.test(trimmed)) {
        return invalid('Use the format YYYY-MM-DD, for example 1990-06-15.');
    }

    return isRealCalendarDate(trimmed) ? valid() : invalid('That is not a real date.');
}

function validatePassword(value) {
    if (value.length < 8) {
        return invalid('Password must be at least 8 characters long.');
    }

    if (value.length > 128) {
        return invalid('Password must be at most 128 characters long.');
    }

    if (!/[A-Z]/.test(value)) {
        return invalid('Password must contain at least one uppercase letter.');
    }

    if (!/[a-z]/.test(value)) {
        return invalid('Password must contain at least one lowercase letter.');
    }

    if (!/[0-9]/.test(value)) {
        return invalid('Password must contain at least one number.');
    }

    if (!/[^A-Za-z0-9]/.test(value)) {
        return invalid('Password must contain at least one special character.');
    }

    return valid();
}

const VALIDATOR_BY_STEP = {
    name_provided: validateName,
    email_collection: validateEmail,
    phone_collection: validatePhone,
    birth_date_collection: validateBirthDate,
    password_collection: validatePassword,
};

/**
 * Validates one turn against the step it answers.
 *
 * The server validates nothing - advanceChat() accepts any string at every step -
 * so without this the first sign of a bad email is a bulk 400 from
 * /user/chat-assisted after all six answers. Rules mirror
 * ChatAssistedRegistrationSchema field for field.
 *
 * @param {string} step
 * @param {string} value
 * @returns {{valid: boolean, error: string|null}}
 */
export function validate(step, value) {
    const raw = String(value ?? '');

    if (raw.trim().length === 0) {
        return invalid('Please enter a reply.');
    }

    const validator = VALIDATOR_BY_STEP[step];

    return validator ? validator(raw) : valid();
}

const BASE_INPUT_PROPS = {
    keyboardType: 'default',
    autoCapitalize: 'sentences',
    autoCorrect: true,
    secureTextEntry: false,
    textContentType: 'none',
};

// iOS 'numbers-and-punctuation' keeps the hyphens YYYY-MM-DD needs; Android has
// no such key type, so it falls back to the plain numeric pad.
const DATE_KEYBOARD_TYPE = Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric';

const INPUT_PROPS_BY_STEP = {
    name_provided: { autoCapitalize: 'words', autoCorrect: false, textContentType: 'name' },
    email_collection: {
        keyboardType: 'email-address',
        autoCapitalize: 'none',
        autoCorrect: false,
        textContentType: 'emailAddress',
    },
    phone_collection: {
        keyboardType: 'phone-pad',
        autoCapitalize: 'none',
        autoCorrect: false,
        textContentType: 'telephoneNumber',
    },
    birth_date_collection: { keyboardType: DATE_KEYBOARD_TYPE, autoCapitalize: 'none', autoCorrect: false },
    password_collection: {
        autoCapitalize: 'none',
        autoCorrect: false,
        secureTextEntry: true,
        textContentType: 'newPassword',
    },
};

/**
 * The TextInput configuration appropriate to the question being asked.
 *
 * @param {string} step
 * @returns {object} Props to spread onto the chat TextInput.
 */
export function inputPropsForStep(step) {
    return { ...BASE_INPUT_PROPS, ...(INPUT_PROPS_BY_STEP[step] ?? {}) };
}

/**
 * Maps the accumulated answers onto the `userData` payload the API expects.
 *
 * @param {{name?: string, email?: string, phone?: string, birthDate?: string, password?: string}} collected
 * @returns {object} The `userData` object for POST /user/chat-assisted.
 */
export function toUserData(collected) {
    const { firstName, lastName } = splitName(collected.name ?? '');

    const userData = {
        email: String(collected.email ?? '')
            .trim()
            .toLowerCase(),
        password: collected.password ?? '',
        birthDate: String(collected.birthDate ?? '').trim(),
        firstName,
        lastName,
    };

    // `phone` is optional server-side and the route stores 'N/A' when absent, so
    // an unanswered phone step must be omitted rather than sent empty.
    const phone = String(collected.phone ?? '').trim();
    if (phone.length > 0) {
        userData.phone = phone;
    }

    return userData;
}
