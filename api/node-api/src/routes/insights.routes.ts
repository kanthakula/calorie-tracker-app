import { Router } from 'express';
import { z } from 'zod';
import { IsoDateSchema } from '@k21/validation';
import { asyncHandler } from '../lib/errors.js';
import { requireUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getStreak, getWeekly } from '../services/insights.service.js';

export const insightsRouter = Router();
insightsRouter.use(requireUser);

insightsRouter.get(
  '/streak',
  validate(z.object({ today: IsoDateSchema }), 'query'),
  asyncHandler(async (req, res) => {
    const { today } = req.query as unknown as { today: string };
    res.json(await getStreak(req.user!.id, today));
  }),
);

insightsRouter.get(
  '/weekly',
  validate(z.object({ weekEnd: IsoDateSchema }), 'query'),
  asyncHandler(async (req, res) => {
    const { weekEnd } = req.query as unknown as { weekEnd: string };
    res.json(await getWeekly(req.user!.id, weekEnd));
  }),
);
