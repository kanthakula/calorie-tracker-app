import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../env.js';

export interface JwtPayload {
  sub: string; // user id
  email: string;
}

export function signToken(payload: JwtPayload): string {
  // env.JWT_EXPIRES_IN is a plain string like "7d"; cast to satisfy the SignOptions type.
  const options = { expiresIn: env.JWT_EXPIRES_IN } as SignOptions;
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string') throw new Error('Invalid token payload');
  return { sub: String(decoded.sub), email: String(decoded.email) };
}
