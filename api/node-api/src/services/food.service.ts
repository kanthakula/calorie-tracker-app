import { prisma } from '@k21/db';
import { FOOD_CATEGORIES, type FoodItem } from '@k21/validation';

export function listCategories(): readonly string[] {
  return FOOD_CATEGORIES;
}

export async function listFoods(category?: string, search?: string): Promise<FoodItem[]> {
  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (search) where.name = { contains: search, mode: 'insensitive' };
  const rows = await prisma.foodItem.findMany({
    where,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category as FoodItem['category'],
    serving: r.serving,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
  }));
}
