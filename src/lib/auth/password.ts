import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;
const HASH_CACHE_TTL_MS = 30000;

const hashCache = new Map<string, { promise: Promise<string>; timestamp: number }>();

export async function hashPassword(plain: string): Promise<string> {
    const now = Date.now();
    const cached = hashCache.get(plain);

    if (cached) {
        if (cached.promise) {
            return cached.promise;
        }
        if (now - cached.timestamp < HASH_CACHE_TTL_MS) {
            return cached.promise;
        }
        hashCache.delete(plain);
    }

    const promise = bcrypt.hash(plain, SALT_ROUNDS);
    hashCache.set(plain, { promise, timestamp: now });

    try {
        const hash = await promise;
        hashCache.set(plain, { promise: Promise.resolve(hash), timestamp: now });
        return hash;
    } catch (error) {
        hashCache.delete(plain);
        throw error;
    }
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
}
