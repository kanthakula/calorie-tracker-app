// Derive a healthiness rating (1–5) for a library food from its category, per the
// product spec. Used when adding a food-library item as a meal.
import type { FoodCategory } from '@k21/validation';

const CATEGORY_HEALTH: Record<FoodCategory, number> = {
  Fruits: 5,
  Vegetables: 5,
  Proteins: 4,
  Dairy: 4,
  'Nuts & Seeds': 4,
  'Grains & Bread': 3,
  Indian: 3,
  Beverages: 3,
  Snacks: 2,
  'Fast Food': 2,
  Sweets: 1,
};

export function healthForCategory(category: string): number {
  return CATEGORY_HEALTH[category as FoodCategory] ?? 0;
}

/** A short label + accent for a 0–5 health value (0 = unrated). */
export function healthLabel(health: number): { label: string; tone: string } {
  if (health <= 0) return { label: 'Unrated', tone: 'muted' };
  if (health >= 4.5) return { label: 'Very healthy', tone: 'great' };
  if (health >= 3.5) return { label: 'Healthy', tone: 'good' };
  if (health >= 2.5) return { label: 'Moderate', tone: 'ok' };
  if (health >= 1.5) return { label: 'Less healthy', tone: 'warn' };
  return { label: 'Indulgent', tone: 'bad' };
}
