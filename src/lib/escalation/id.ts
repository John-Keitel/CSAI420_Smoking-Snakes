import { randomBytes } from 'node:crypto';

/** Public-facing escalation identifier, e.g. `esc_4f9a1c2b8e0d3a71`. */
export function generateEscalationId(): string {
    return `esc_${randomBytes(12).toString('hex')}`;
}
