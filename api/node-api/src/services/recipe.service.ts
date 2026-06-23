import { prisma } from '@k21/db';
import type { CreateRecipe, Recipe } from '@k21/validation';
import { NotFoundError } from '../lib/errors.js';

type IngredientRow = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type RecipeRow = {
  id: string;
  name: string;
  servings: number;
  createdAt: Date;
  ingredients: IngredientRow[];
};

/** Sum the ingredient macros into the recipe's whole-dish totals. */
function toRecipe(r: RecipeRow): Recipe {
  const totals = r.ingredients.reduce(
    (acc, i) => {
      acc.calories += i.calories;
      acc.protein += i.protein;
      acc.carbs += i.carbs;
      acc.fat += i.fat;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return {
    id: r.id,
    name: r.name,
    servings: r.servings,
    calories: totals.calories,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    ingredients: r.ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      calories: i.calories,
      protein: i.protein,
      carbs: i.carbs,
      fat: i.fat,
    })),
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listRecipes(userId: string): Promise<Recipe[]> {
  const rows = await prisma.recipe.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
    include: { ingredients: true },
  });
  return rows.map(toRecipe);
}

export async function createRecipe(
  userId: string,
  input: CreateRecipe,
): Promise<Recipe> {
  const row = await prisma.recipe.create({
    data: {
      userId,
      name: input.name,
      servings: input.servings,
      ingredients: { create: input.ingredients },
    },
    include: { ingredients: true },
  });
  return toRecipe(row);
}

export async function deleteRecipe(userId: string, id: string): Promise<void> {
  const existing = await prisma.recipe.findFirst({ where: { id, userId } });
  if (!existing) throw new NotFoundError('Recipe not found.');
  await prisma.recipe.delete({ where: { id } });
}
