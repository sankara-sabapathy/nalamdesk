import crypto from 'crypto';

// Fail fast in production
if (process.env.NODE_ENV === 'production' && !process.env.APP_SECRET) {
    throw new Error('APP_SECRET must be set in production');
}
const APP_SECRET = process.env.APP_SECRET || 'nalam_build_secret_v1';

export const generateApiKey = () => {
    return 'nk_live_' + crypto.randomBytes(24).toString('hex');
};

export const generateId = () => {
    return crypto.randomUUID();
};

export const hashApiKey = (key: string): string => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(key, salt, 64).toString('hex');
    return `${salt}:${hash}`;
};

export const verifyApiKey = (key: string, storedHash: string): boolean => {
    if (!storedHash || !storedHash.includes(':')) return false;
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, hash] = parts;

    // Validate hex
    if (!/^[0-9a-fA-F]+$/.test(hash)) return false;

    const verifyHash = crypto.scryptSync(key, salt, 64);
    const originalHash = Buffer.from(hash, 'hex');

    // Constant time comparison
    if (verifyHash.length !== originalHash.length) return false;
    return crypto.timingSafeEqual(verifyHash, originalHash);
};

export const validateAppSecret = (incomingSecret: string): boolean => {
    if (!incomingSecret) return false;

    // Use SHA-256 for fixed length comparison
    const hashA = crypto.createHash('sha256').update(incomingSecret).digest();
    const hashB = crypto.createHash('sha256').update(APP_SECRET).digest();

    return crypto.timingSafeEqual(hashA, hashB);
};
