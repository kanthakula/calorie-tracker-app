import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { corsOrigins, env, isProd } from './env.js';
import { errorHandler, notFoundHandler } from './lib/errors.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  // Allow the app to be opened from other devices on the same LAN: accept any
  // configured origin, plus localhost and private-network origins (10/8,
  // 192.168/16, 172.16-31/12). Tighten CORS_ORIGINS for a public deployment.
  const PRIVATE_ORIGIN =
    /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;
  app.use(
    cors({
      origin: (origin, cb) => {
        // No Origin header → non-browser client (curl, native mobile) → allow.
        if (!origin || corsOrigins.includes(origin) || PRIVATE_ORIGIN.test(origin)) {
          return cb(null, true);
        }
        return cb(null, false);
      },
      credentials: true,
    }),
  );
  // Base64 images arrive as JSON; ~4MB image -> ~5.5MB encoded, plus slack.
  app.use(express.json({ limit: '8mb' }));
  app.use(morgan(isProd ? 'combined' : 'dev'));

  app.get('/', (_req, res) => {
    res.json({ name: 'K21 Node API', version: '0.1.0', docs: '/api/health' });
  });

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export { env };
