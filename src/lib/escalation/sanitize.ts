/**
 * Strips markup from escalation text fields before persisting/returning them.
 * Removes DOCTYPE/entity declarations and <script> blocks outright (content and
 * all), then strips any remaining tags generically so plain text survives.
 */
export function sanitizeText(input: string): string {
    return input
        .replace(/<!DOCTYPE[^>]*>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .trim();
}
