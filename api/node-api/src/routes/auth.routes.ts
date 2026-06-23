import { Router } from 'express';
import { LoginSchema, RegisterSchema } from '@k21/validation';
import { asyncHandler } from '../lib/errors.js';
import { requireUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getProfile, login, register } from '../services/auth.service.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  validate(RegisterSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await register(req.body));
  }),
);

authRouter.post(
  '/login',
  validate(LoginSchema),
  asyncHandler(async (req, res) => {
    res.json(await login(req.body));
  }),
);

authRouter.get(
  '/me',
  requireUser,
  asyncHandler(async (req, res) => {
    res.json(await getProfile(req.user!.id));
  }),
);
