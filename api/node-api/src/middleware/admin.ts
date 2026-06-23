// Owner-only admin gate. Login (ADMIN_PASSWORD) mints a short-lived in-memory
// token; admin routes require it. Mirrors the original app's admin model.
import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../env.js';
import { ConfigError, UnauthorizedError } from '../lib/errors.js';

const ADMIN_TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const adminTokens = new Map<string, number>(); // token -> expiresAt

/** Admin requires BOTH a username and a password to be configured. */
export function adminEnabled(): boolean {
  return env.ADMIN_USERNAME.trim().length > 0 && env.ADMIN_PASSWORD.trim().length > 0;
}

function constantTimeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Validates the owner username + password and returns a fresh token (throws on
 * mismatch). Both checks always run (no early return) to avoid leaking which
 * field was wrong via timing.
 */
export function adminLogin(
  username: string,
  password: string,
): { token: string; expiresInMs: number } {
  if (!adminEnabled()) {
    throw new ConfigError(
      'Admin console is disabled. Set ADMIN_USERNAME and ADMIN_PASSWORD and restart.',
    );
  }
  const okUser =
    typeof username === 'string' &&
    constantTimeEqual(username, env.ADMIN_USERNAME.trim());
  const okPass =
    typeof password === 'string' &&
    constantTimeEqual(password, env.ADMIN_PASSWORD.trim());
  if (!okUser || !okPass) {
    throw new UnauthorizedError('Incorrect username or password.');
  }
  const token = crypto.randomBytes(32).toString('hex');
  adminTokens.set(token, Date.now() + ADMIN_TOKEN_TTL_MS);
  return { token, expiresInMs: ADMIN_TOKEN_TTL_MS };
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!adminEnabled()) {
    return next(
      new ConfigError(
        'Admin console is disabled. Set ADMIN_USERNAME and ADMIN_PASSWORD and restart.',
      ),
    );
  }
  const token = req.headers['x-admin-token'];
  if (typeof token !== 'string') return next(new UnauthorizedError('Not authorized. Please log in.'));
  const expiresAt = adminTokens.get(token);
  if (!expiresAt) return next(new UnauthorizedError('Not authorized. Please log in.'));
  if (Date.now() > expiresAt) {
    adminTokens.delete(token);
    return next(new UnauthorizedError('Session expired. Please log in again.'));
  }
  next();
}
