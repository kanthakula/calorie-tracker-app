import { Router } from 'express';
import { z } from 'zod';
import { IsoDateSchema, LogWaterSchema } from '@k21/validation';
import { asyncHandler } from '../lib/errors.js';
import { requireUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getWater, logWater } from '../services/water.service.js';

export const waterRouter = Router();
waterRouter.use(requireUser);

waterRouter.get(
  '/',
  validate(z.object({ date: IsoDateSchema }), 'query'),
  asyncHandler(async (req, res) => {
    const { date } = req.query as unknown as { date: string };
    res.json(await getWater(req.user!.id, date));
  }),
);

waterRouter.post(
  '/',
  validate(LogWaterSchema),
  asyncHandler(async (req, res) => {
    res.json(await logWater(req.user!.id, req.body));
  }),
);
