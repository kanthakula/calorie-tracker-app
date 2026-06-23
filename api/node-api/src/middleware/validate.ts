// Zod validation middleware: parse + replace req.body/query/params with typed,
// validated data. On failure, the ZodError is forwarded to the error handler.
import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';

type Source = 'body' | 'query' | 'params';

export function validate(schema: ZodTypeAny, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(result.error);
    // Express 4's req.query/params are read-only getters in some setups; assign safely.
    if (source === 'body') req.body = result.data;
    else Object.defineProperty(req, source, { value: result.data, configurable: true });
    next();
  };
}
