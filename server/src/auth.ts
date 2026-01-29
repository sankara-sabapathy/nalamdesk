import crypto from 'crypto';

// TODO: Move this to environment variable in production
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
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.scryptSync(key, salt, 64).toString('hex');
    return hash === verifyHash;
};

export const validateAppSecret = (incomingSecret: string): boolean => {
    return incomingSecret === APP_SECRET;
};
