import { Router } from 'express';
import { CreateRecipeSchema } from '@k21/validation';
import { asyncHandler, BadRequestError } from '../lib/errors.js';
import { requireUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createRecipe,
  deleteRecipe,
  listRecipes,
} from '../services/recipe.service.js';

export const recipeRouter = Router();
recipeRouter.use(requireUser);

recipeRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await listRecipes(req.user!.id));
  }),
);

recipeRouter.post(
  '/',
  validate(CreateRecipeSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createRecipe(req.user!.id, req.body));
  }),
);

recipeRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new BadRequestError('Recipe id is required.');
    await deleteRecipe(req.user!.id, id);
    res.status(204).send();
  }),
);
