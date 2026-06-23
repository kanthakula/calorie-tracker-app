// Purposeful, scannable emoji system for the K21 brand revamp.
// Maps + small helpers used across meal-type selectors, meal rows, the food
// library, the add-meal form, and the macro/summary readouts. Kept tasteful:
// one glyph per concept, never decorative noise.
import type { MealType } from '@k21/validation';

/** Meal-type glyphs, used in the meal-slot selector and meal rows. */
export const MEAL_TYPE_EMOJI: Record<MealType, string> = {
  breakfast: '🍳',
  lunch: '🥗',
  dinner: '🍝',
  snack: '🍎',
};

export function mealTypeEmoji(type: MealType | string): string {
  return MEAL_TYPE_EMOJI[type as MealType] ?? '🍽️';
}

/** Food-library category glyphs, used on category chips and food cards. */
export const CATEGORY_EMOJI: Record<string, string> = {
  Fruits: '🍇',
  Vegetables: '🥦',
  'Grains & Bread': '🍞',
  Proteins: '🍗',
  Dairy: '🧀',
  Indian: '🍛',
  Snacks: '🍿',
  'Fast Food': '🍔',
  Beverages: '🥤',
  Sweets: '🍰',
  'Nuts & Seeds': '🥜',
};

export function categoryEmoji(category: string): string {
  return CATEGORY_EMOJI[category] ?? '🍽️';
}

/** Misc brand markers — single source of truth so they stay consistent. */
export const MISC_EMOJI = {
  calories: '🔥',
  streak: '🔥',
  water: '💧',
  workout: '🏃',
  protein: '🥩',
  carbs: '🌾',
  fat: '🥑',
  meals: '🍽️',
  insight: '💡',
} as const;

/** Macro key → emoji, for the macro tiles. */
export const MACRO_EMOJI = {
  protein: MISC_EMOJI.protein,
  carbs: MISC_EMOJI.carbs,
  fat: MISC_EMOJI.fat,
} as const;

export type MacroKey = keyof typeof MACRO_EMOJI;
