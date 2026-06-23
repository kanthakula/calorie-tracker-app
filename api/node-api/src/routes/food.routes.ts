import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/errors.js';
import { requireUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listCategories, listFoods } from '../services/food.service.js';

export const foodRouter = Router();
foodRouter.use(requireUser);

foodRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    res.json(listCategories());
  }),
);

foodRouter.get(
  '/',
  validate(z.object({ category: z.string().optional(), search: z.string().optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const { category, search } = req.query as unknown as { category?: string; search?: string };
    res.json(await listFoods(category, search));
  }),
);
