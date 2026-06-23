import { Router } from 'express';
import { z } from 'zod';
import {
  CreateMealSchema,
  IsoDateSchema,
  MealQuerySchema,
  UpdateMealSchema,
} from '@k21/validation';
import { asyncHandler, BadRequestError } from '../lib/errors.js';
import { requireUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createMeal,
  dailyTotals,
  deleteMeal,
  listMeals,
  recentMeals,
  updateMeal,
} from '../services/meal.service.js';
import { getAdaptiveContext } from '../services/adaptive.service.js';
import { getWater } from '../services/water.service.js';
import { computeBMR } from '@k21/validation';
import { buildAlerts, buildInsight } from '../services/insight.service.js';
import { getGoal, hasGoalSet } from '../services/goal.service.js';
import { getProfile } from '../services/profile.service.js';
import { burnedForDate, listWorkouts } from '../services/workout.service.js';

export const mealRouter = Router();
mealRouter.use(requireUser);

mealRouter.get(
  '/',
  validate(MealQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    res.json(await listMeals(req.user!.id, req.query as never));
  }),
);

// Daily summary: totals + goal + insight for ?date=YYYY-MM-DD.
mealRouter.get(
  '/summary',
  validate(z.object({ date: IsoDateSchema }), 'query'),
  asyncHandler(async (req, res) => {
    const { date } = req.query as unknown as { date: string };
    const userId = req.user!.id;
    const totals = await dailyTotals(userId, date);
    const goal = await getGoal(userId, date);
    const goalIsManual = await hasGoalSet(userId, date);
    const { profile } = await getProfile(userId);
    // Targets reflect the adaptive engine when there's enough data.
    const adaptive = await getAdaptiveContext(userId, date);
    const targets = adaptive.effectiveTargets;
    // Ring goal: an explicit manual goal wins; otherwise follow the
    // estimated/adaptive calorie target so the ring, macros, and insight agree.
    const calorieGoal = goalIsManual
      ? goal.calorieGoal
      : (targets?.calorieTarget ?? goal.calorieGoal);
    const effectiveGoal = { date: goal.date, calorieGoal };

    // Workouts + energy balance (net = intake − resting − active).
    const workouts = await listWorkouts(userId, date);
    const burned = await burnedForDate(userId, date);
    const restingBurn = computeBMR(profile);
    const net = restingBurn == null ? null : totals.calories - restingBurn - burned;
    const energy = { intake: totals.calories, burned, restingBurn, net };

    const waterDay = await getWater(userId, date);
    const water = { ml: waterDay.ml, targetMl: targets?.waterTargetMl ?? null };

    res.json({
      totals,
      goal: effectiveGoal,
      targets,
      insight: buildInsight(totals, calorieGoal),
      alerts: buildAlerts(totals, targets),
      workouts,
      energy,
      water,
      adaptiveTdee: adaptive.adaptiveTdee,
      targetSource: adaptive.targetSource,
    });
  }),
);

// Recent distinct meals for one-tap re-logging.
mealRouter.get(
  '/recent',
  asyncHandler(async (req, res) => {
    res.json(await recentMeals(req.user!.id));
  }),
);

mealRouter.post(
  '/',
  validate(CreateMealSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createMeal(req.user!.id, req.body));
  }),
);

mealRouter.patch(
  '/:id',
  validate(UpdateMealSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new BadRequestError('Meal id is required.');
    res.json(await updateMeal(req.user!.id, id, req.body));
  }),
);

mealRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    if (!id) throw new BadRequestError('Meal id is required.');
    await deleteMeal(req.user!.id, id);
    res.status(204).send();
  }),
);
