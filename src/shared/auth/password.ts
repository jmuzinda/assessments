import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export interface PasswordHasherOptions {
  cost: number;
}

export function hashPassword(password: string, options: PasswordHasherOptions): string {
  const salt = randomBytes(16).toString('base64url');
  const derived = scryptSync(password, salt, 32, { N: options.cost, r: 8, p: 1 });
  return `scrypt$${options.cost}$${salt}$${derived.toString('base64url')}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [algorithm, costText, salt, hashText] = encoded.split('$');
  if (algorithm !== 'scrypt' || !costText || !salt || !hashText) {
    return false;
  }
  const cost = Number(costText);
  if (!Number.isInteger(cost) || cost < 2) {
    return false;
  }
  const expected = Buffer.from(hashText, 'base64url');
  const derived = scryptSync(password, salt, expected.length, { N: cost, r: 8, p: 1 });
  if (derived.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(derived, expected);
}
