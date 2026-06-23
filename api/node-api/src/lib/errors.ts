// Typed application errors + Express helpers so routes can throw and a single
// middleware turns them into safe JSON responses (never leaking internals).
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public expose = true,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(400, message);
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = 'Not authorized') {
    super(401, message);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message);
  }
}
export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, message);
  }
}
export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(409, message);
  }
}
/** Provider/key/model not configured — caller-fixable (503). */
export class ConfigError extends AppError {
  constructor(message = 'Service not configured') {
    super(503, message);
  }
}
/** Upstream (AI service / provider) failed — not the caller's fault (502). */
export class UpstreamError extends AppError {
  constructor(message = 'Upstream service error') {
    super(502, message);
  }
}

/** Wrap an async route handler so thrown/rejected errors reach the error middleware. */
export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req as T, res, next).catch(next);
  };
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.expose ? err.message : 'Request failed' });
  }
  // Unknown error: log server-side, return a generic message (never leak details/keys).
  console.error('Unhandled error:', err instanceof Error ? err.message : err);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
