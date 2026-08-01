import { ZodError } from 'zod';

type ValidationError = {
    message: string;
    errors: Record<string, string[]>;
};

export function formatZodErrors(zodError: ZodError): ValidationError {
    return {
        message: 'validation error',
        errors: zodError.issues.reduce(
            (acc, error) => {
                const field = error.path.join('.'); // Join path segments for nested fields
                if (!acc[field]) {
                    acc[field] = [];
                }
                acc[field].push(error.message);
                return acc;
            },
            {} as Record<string, string[]>
        ),
    };
}

/**
 * Strip markup from free text supplied by an external caller before it is stored
 * or echoed back. Declarations (doctype, processing instructions, comments) are
 * removed first because they can wrap nested brackets, so the generic `<[^>]*>`
 * pass alone would leave their tail behind. Whitespace is normalized last.
 */
export function stripHtml(input: string): string {
    return input
        .replace(/\p{Cc}/gu, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<\?[\s\S]*?\?>/g, ' ')
        .replace(/<![^<>]*(?:\[[\s\S]*?\][^<>]*)?>/g, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
