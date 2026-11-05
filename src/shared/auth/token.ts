import { createHmac, timingSafeEqual } from 'node:crypto';
import { Errors } from '../kernel/errors';

export interface TokenClaims {
  sub: string;
  org: string;
  iat: number;
  exp: number;
}

function encode(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function sign(content: string, secret: string): string {
  return createHmac('sha256', secret).update(content).digest('base64url');
}

export function signToken(input: {
  userId: string;
  organizationId: string;
  secret: string;
  ttlSeconds: number;
  now: Date;
}): string {
  const issuedAt = Math.floor(input.now.getTime() / 1000);
  const claims: TokenClaims = {
    sub: input.userId,
    org: input.organizationId,
    iat: issuedAt,
    exp: issuedAt + input.ttlSeconds,
  };
  const content = `${encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${encode(JSON.stringify(claims))}`;
  return `${content}.${sign(content, input.secret)}`;
}

export function verifyToken(token: string, secret: string, now: Date): TokenClaims {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw Errors.unauthenticated('Invalid access token');
  }
  const [header, payload, signature] = parts;
  if (!header || !payload || !signature) {
    throw Errors.unauthenticated('Invalid access token');
  }
  const content = `${header}.${payload}`;
  const expected = sign(content, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw Errors.unauthenticated('Invalid access token');
  }
  let claims: TokenClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenClaims;
  } catch {
    throw Errors.unauthenticated('Invalid access token');
  }
  if (!claims.sub || !claims.org || !claims.exp) {
    throw Errors.unauthenticated('Invalid access token');
  }
  if (claims.exp <= Math.floor(now.getTime() / 1000)) {
    throw Errors.unauthenticated('Access token has expired');
  }
  return claims;
}
