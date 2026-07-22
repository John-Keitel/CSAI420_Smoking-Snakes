import { prisma } from '@/lib/db';

type CredentialUser = {
    id: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    emailVerified: Date | null;
};

function getAuthName(user: CredentialUser): string {
    const fullName = `${user.firstName} ${user.lastName}`.trim();
    return fullName.length > 0 ? fullName : user.email;
}

export async function syncCredentialAccount(user: CredentialUser): Promise<void> {
    await prisma.user.update({
        where: { id: user.id },
        data: {
            authName: getAuthName(user),
            authEmailVerified: Boolean(user.emailVerified),
        },
    });

    await prisma.account.upsert({
        where: {
            providerId_accountId: {
                providerId: 'credential',
                accountId: user.email,
            },
        },
        create: {
            providerId: 'credential',
            accountId: user.email,
            userId: user.id,
            password: user.password,
        },
        update: {
            userId: user.id,
            password: user.password,
        },
    });
}
