import { prisma } from '@/lib/db';

export async function upsertStediSessionLink(sessionId: string, token: string, username: string): Promise<void> {
    await prisma.stediSessionLink.upsert({
        where: { sessionId },
        create: {
            sessionId,
            stediToken: token,
            username,
        },
        update: {
            stediToken: token,
            username,
        },
    });
}

export async function getStediTokenForSession(sessionId: string): Promise<string | null> {
    const sessionLink = await prisma.stediSessionLink.findUnique({
        where: { sessionId },
        select: { stediToken: true },
    });

    return sessionLink?.stediToken ?? null;
}

export async function deleteStediSessionLink(sessionId: string): Promise<void> {
    await prisma.stediSessionLink.deleteMany({
        where: { sessionId },
    });
}
