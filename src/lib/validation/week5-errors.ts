import type { ZodError } from 'zod';

/**
 * Week 5 contract: validation failures surface as a flat string array
 * (`{ errors: string[] }`). The shared `formatZodErrors` returns an object
 * keyed by field, which the Week 5 suite rejects — this feature-local
 * formatter exists because that shared helper must not change.
 */
export function flattenZodErrors(zodError: ZodError): { errors: string[] } {
    return {
        errors: zodError.issues.map((issue) => {
            const field = issue.path.join('.');
            return field ? `${field}: ${issue.message}` : issue.message;
        }),
    };
}
