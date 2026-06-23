import { Router } from 'express';
import { z } from 'zod';
import { IsoDateSchema, LogWeightSchema } from '@k21/validation';
import { asyncHandler, BadRequestError } from '../lib/errors.js';
import { requireUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { deleteWeight, listWeights, logWeight } from '../services/weight.service.js';

export const weightRouter = Router();
weightRouter.use(requireUser);

weightRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await listWeights(req.user!.id));
  }),
);

weightRouter.post(
  '/',
  validate(LogWeightSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await logWeight(req.user!.id, req.body));
  }),
);

weightRouter.delete(
  '/:date',
  asyncHandler(async (req, res) => {
    const date = req.params.date ?? '';
    if (!IsoDateSchema.safeParse(date).success) throw new BadRequestError('Invalid date.');
    await deleteWeight(req.user!.id, date);
    res.status(204).send();
  }),
);
