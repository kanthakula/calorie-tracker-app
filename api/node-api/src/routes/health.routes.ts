import { Router } from 'express';
import { env } from '../env.js';
import { asyncHandler } from '../lib/errors.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'node-api', env: env.NODE_ENV });
});

// Liveness of the downstream AI service (best-effort).
healthRouter.get(
  '/ai',
  asyncHandler(async (_req, res) => {
    try {
      const r = await fetch(`${env.AI_SERVICE_URL.replace(/\/$/, '')}/health`);
      res.json({ aiService: r.ok ? 'ok' : 'degraded', url: env.AI_SERVICE_URL });
    } catch {
      res.status(200).json({ aiService: 'unreachable', url: env.AI_SERVICE_URL });
    }
  }),
);
