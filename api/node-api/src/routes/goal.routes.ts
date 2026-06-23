import { Router } from 'express';
import { z } from 'zod';
import { IsoDateSchema, SetGoalSchema } from '@k21/validation';
import { asyncHandler } from '../lib/errors.js';
import { requireUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getGoal, setGoal } from '../services/goal.service.js';

export const goalRouter = Router();
goalRouter.use(requireUser);

goalRouter.get(
  '/',
  validate(z.object({ date: IsoDateSchema.optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const { date } = req.query as unknown as { date?: string };
    res.json(await getGoal(req.user!.id, date ?? null));
  }),
);

goalRouter.put(
  '/',
  validate(SetGoalSchema),
  asyncHandler(async (req, res) => {
    res.json(await setGoal(req.user!.id, req.body));
  }),
);
