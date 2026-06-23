import { Router } from 'express';
import { StartFastSchema } from '@k21/validation';
import { asyncHandler } from '../lib/errors.js';
import { requireUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  endFast,
  getFastingState,
  startFast,
} from '../services/fasting.service.js';

export const fastingRouter = Router();
fastingRouter.use(requireUser);

fastingRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getFastingState(req.user!.id));
  }),
);

fastingRouter.post(
  '/start',
  validate(StartFastSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await startFast(req.user!.id, req.body.targetHours));
  }),
);

fastingRouter.post(
  '/end',
  asyncHandler(async (req, res) => {
    res.json(await endFast(req.user!.id));
  }),
);
