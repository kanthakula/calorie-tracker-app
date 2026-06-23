import { Router } from 'express';
import { z } from 'zod';
import { CreateWorkoutSchema, IsoDateSchema, UpdateWorkoutSchema } from '@k21/validation';
import { asyncHandler, BadRequestError } from '../lib/errors.js';
import { requireUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createWorkout,
  deleteWorkout,
  listWorkouts,
  updateWorkout,
} from '../services/workout.service.js';

export const workoutRouter = Router();
workoutRouter.use(requireUser);

workoutRouter.get(
  '/',
  validate(z.object({ date: IsoDateSchema }), 'query'),
  asyncHandler(async (req, res) => {
    const { date } = req.query as unknown as { date: string };
    res.json(await listWorkouts(req.user!.id, date));
  }),
);

workoutRouter.post(
  '/',
  validate(CreateWorkoutSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createWorkout(req.user!.id, req.body));
  }),
);

workoutRouter.patch(
  '/:id',
  validate(UpdateWorkoutSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new BadRequestError('Workout id is required.');
    res.json(await updateWorkout(req.user!.id, id, req.body));
  }),
);

workoutRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new BadRequestError('Workout id is required.');
    await deleteWorkout(req.user!.id, id);
    res.status(204).send();
  }),
);
