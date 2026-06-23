import { Router } from 'express';
import { CreateSavedMealSchema } from '@k21/validation';
import { asyncHandler, BadRequestError } from '../lib/errors.js';
import { requireUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createSavedMeal,
  deleteSavedMeal,
  listSavedMeals,
} from '../services/savedmeal.service.js';

export const savedMealRouter = Router();
savedMealRouter.use(requireUser);

savedMealRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await listSavedMeals(req.user!.id));
  }),
);

savedMealRouter.post(
  '/',
  validate(CreateSavedMealSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createSavedMeal(req.user!.id, req.body));
  }),
);

savedMealRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new BadRequestError('Saved meal id is required.');
    await deleteSavedMeal(req.user!.id, id);
    res.status(204).send();
  }),
);
