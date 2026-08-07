function stripScriptsAndTags(value: string): string {
    return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ');
}

function stripInjectionChars(value: string): string {
    return value
        .replace(/[<>`"'\\;$]/g, ' ')
        .replace(/--/g, ' ')
        .replace(/\/\*/g, ' ')
        .replace(/\*\//g, ' ');
}

export function sanitizeInputString(value: string): string {
    return stripInjectionChars(stripScriptsAndTags(value)).replace(/\s+/g, ' ').trim();
}

export function sanitizeObjectStrings<T>(input: T): T {
    if (Array.isArray(input)) {
        return input.map((item) => sanitizeObjectStrings(item)) as T;
    }

    if (input !== null && typeof input === 'object') {
        const sanitizedEntries = Object.entries(input as Record<string, unknown>).map(([key, value]) => [key, sanitizeObjectStrings(value)]);

        return Object.fromEntries(sanitizedEntries) as T;
    }

    if (typeof input === 'string') {
        return sanitizeInputString(input) as T;
    }

    return input;
}

export type SanitizedUserRegistrationInput = {
    name: string;
    email: string;
    password: string;
    dob: Date;
};

export function sanitizeUserRegistrationInput(input: SanitizedUserRegistrationInput): SanitizedUserRegistrationInput {
    return {
        ...input,
        name: sanitizeInputString(input.name),
        email: sanitizeInputString(input.email).toLowerCase(),
        password: sanitizeInputString(input.password),
    };
}
