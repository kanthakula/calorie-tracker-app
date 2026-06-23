import { prisma } from '@k21/db';
import type { CreateMeal, DailyTotals, Meal, MealQuery, UpdateMeal } from '@k21/validation';
import { NotFoundError } from '../lib/errors.js';

type MealRow = {
  id: string;
  name: string;
  calories: number;
  type: string;
  date: string;
  protein: number;
  carbs: number;
  fat: number;
  health: number;
  source: string;
  createdAt: Date;
  updatedAt: Date;
};

function toMeal(m: MealRow): Meal {
  return {
    id: m.id,
    name: m.name,
    calories: m.calories,
    type: m.type as Meal['type'],
    date: m.date,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
    health: m.health,
    source: m.source as Meal['source'],
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

export async function listMeals(userId: string, query: MealQuery): Promise<Meal[]> {
  const where: Record<string, unknown> = { userId };
  if (query.date) where.date = query.date;
  else if (query.from || query.to) {
    where.date = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }
  const rows = await prisma.meal.findMany({
    where,
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(toMeal);
}

export async function createMeal(userId: string, input: CreateMeal): Promise<Meal> {
  const row = await prisma.meal.create({ data: { ...input, userId } });
  return toMeal(row);
}

export async function updateMeal(
  userId: string,
  id: string,
  input: UpdateMeal,
): Promise<Meal> {
  const existing = await prisma.meal.findFirst({ where: { id, userId } });
  if (!existing) throw new NotFoundError('Meal not found.');
  const row = await prisma.meal.update({ where: { id }, data: input });
  return toMeal(row);
}

export async function deleteMeal(userId: string, id: string): Promise<void> {
  const existing = await prisma.meal.findFirst({ where: { id, userId } });
  if (!existing) throw new NotFoundError('Meal not found.');
  await prisma.meal.delete({ where: { id } });
}

/** Recent distinct meals (by name) for one-tap re-logging. */
export async function recentMeals(userId: string, limit = 12): Promise<Meal[]> {
  const rows = await prisma.meal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 80,
  });
  const seen = new Set<string>();
  const out: Meal[] = [];
  for (const r of rows) {
    const key = r.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(toMeal(r));
    if (out.length >= limit) break;
  }
  return out;
}

/** Aggregate one day's meals into totals (used by the daily summary + insight). */
export async function dailyTotals(userId: string, date: string): Promise<DailyTotals> {
  const meals = await prisma.meal.findMany({ where: { userId, date } });
  const totals = meals.reduce(
    (acc, m) => {
      acc.calories += m.calories;
      acc.protein += m.protein;
      acc.carbs += m.carbs;
      acc.fat += m.fat;
      if (m.health > 0) {
        acc.healthSum += m.health;
        acc.rated += 1;
      }
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, healthSum: 0, rated: 0 },
  );
  return {
    date,
    calories: totals.calories,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    mealCount: meals.length,
    avgHealth: totals.rated > 0 ? Math.round((totals.healthSum / totals.rated) * 10) / 10 : 0,
  };
}
