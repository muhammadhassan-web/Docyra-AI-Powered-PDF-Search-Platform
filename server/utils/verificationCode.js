import { randomInt } from 'crypto';
import bcrypt from 'bcryptjs';

export const RESET_CODE_TTL_MS = 15 * 60 * 1000;

export function generateVerificationCode() {
    return String(randomInt(100000, 1000000)); // 6 digits
}

export async function hashVerificationCode(code) {
    return bcrypt.hash(code, 10);
}

export async function verifyCode(user, code) {
    if (!user.resetCodeHash || !user.resetCodeExpiresAt) return false;
    if (user.resetCodeExpiresAt < new Date()) return false;
    return bcrypt.compare(code, user.resetCodeHash);
}
