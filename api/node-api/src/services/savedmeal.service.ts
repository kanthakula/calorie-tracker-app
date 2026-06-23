import { prisma } from '@k21/db';
import type { CreateSavedMeal, SavedMeal } from '@k21/validation';
import { NotFoundError } from '../lib/errors.js';

type SavedMealRow = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  health: number;
  createdAt: Date;
};

function toSavedMeal(r: SavedMealRow): SavedMeal {
  return {
    id: r.id,
    name: r.name,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    health: r.health,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listSavedMeals(userId: string): Promise<SavedMeal[]> {
  const rows = await prisma.savedMeal.findMany({ where: { userId }, orderBy: { name: 'asc' } });
  return rows.map(toSavedMeal);
}

export async function createSavedMeal(
  userId: string,
  input: CreateSavedMeal,
): Promise<SavedMeal> {
  const row = await prisma.savedMeal.create({ data: { ...input, userId } });
  return toSavedMeal(row);
}

export async function deleteSavedMeal(userId: string, id: string): Promise<void> {
  const existing = await prisma.savedMeal.findFirst({ where: { id, userId } });
  if (!existing) throw new NotFoundError('Saved meal not found.');
  await prisma.savedMeal.delete({ where: { id } });
}
