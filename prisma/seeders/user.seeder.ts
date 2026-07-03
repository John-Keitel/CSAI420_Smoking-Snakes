import { PrismaClient } from '@prisma/client';

import { hashPassword } from '@/lib/auth';

const prisma = new PrismaClient();

export async function seedUsers(): Promise<void> {
    console.log('Seeding users...');
    // Add the developer (super admin) user
    await prisma.user.upsert({
        where: {
            email: 'developer@stedi.com',
        },
        create: {
            type: 'developer',

            // Auth
            email: 'developer@stedi.com',
            phone: '+15555555555',
            emailVerified: new Date(),
            password: await hashPassword('@123Change'),

            // Profile
            firstName: 'Support',
            lastName: 'STEDI',
            displayName: 'Support',
            dateOfBirth: new Date('2000-01-01'),
            // echo -n "support@stedi.com" | md5sum
            image: 'https://gravatar.com/avatar/369efeab2768e52dbcbdfb7a55a39cc8?s=400&d=robohash&r=x',
            timezone: 'America/Denver',
            locale: 'en-US',

            // Terms & Conditions
            termsAccepted: new Date(),
            privacyAccepted: new Date(),
            cookiesAccepted: new Date(),
            textMessagesAccepted: new Date(),
        },
        update: {},
    });

    // Add a provider user
    await prisma.user.upsert({
        where: {
            email: 'user@provider.com',
        },
        create: {
            type: 'provider',

            // Auth
            email: 'user@provider.com',
            phone: '+14444444444',
            emailVerified: new Date(),
            password: await hashPassword('@123Change'),

            // Profile
            firstName: 'User',
            lastName: 'Provider',
            displayName: 'Provider',
            dateOfBirth: new Date('2000-01-01'),
            // echo -n "user@provider.com" | md5sum
            image: 'https://gravatar.com/avatar/d41d8cd98f00b204e9800998ecf8427e?s=400&d=robohash&r=x',
            timezone: 'America/Denver',
            locale: 'en-US',

            // Terms & Conditions
            termsAccepted: new Date(),
            privacyAccepted: new Date(),
            cookiesAccepted: new Date(),
            textMessagesAccepted: new Date(),
        },
        update: {},
    });
}
