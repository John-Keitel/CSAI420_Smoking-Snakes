import type { Session, User } from '@/generated/prisma/client';
import { getSession } from '@/lib/auth';
import { HttpException } from '@/lib/http';

export type ModeratorSession = Session & { user: User };

export function isModeratorType(type: User['type']): boolean {
    return type === 'developer' || type === 'provider';
}

/** Bearer JWT session restricted to developer/provider moderators. */
export async function requireModerator(): Promise<ModeratorSession> {
    const session = await getSession();

    if (!isModeratorType(session.user.type)) {
        throw new HttpException(403, 'Forbidden');
    }

    return session;
}
