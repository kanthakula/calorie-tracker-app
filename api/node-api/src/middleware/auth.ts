import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../lib/errors.js';
import { verifyToken } from '../lib/jwt.js';

// Augment Express Request with the authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

/** Require a valid Bearer JWT; attaches req.user. */
export function requireUser(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header.'));
  }
  try {
    const payload = verifyToken(header.slice('Bearer '.length).trim());
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired session. Please log in again.'));
  }
}
