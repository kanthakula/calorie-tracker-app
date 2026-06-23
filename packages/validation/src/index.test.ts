import { describe, expect, it } from 'vitest';
import {
  AnalyzeFoodResponseSchema,
  CreateMealSchema,
  FoodAnalysisSchema,
  IsoDateSchema,
  MealQuerySchema,
} from './index.js';

describe('contract schemas', () => {
  it('accepts a valid food analysis', () => {
    const ok = FoodAnalysisSchema.safeParse({
      food_name: 'Grilled chicken salad',
      estimated_calories: 420,
      protein_g: 35,
      carbs_g: 18,
      fat_g: 22,
      healthiness_rating: 4,
      portion_recommendation: 'A balanced single serving.',
      confidence: 'high',
      notes: 'Assumes light dressing.',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects an out-of-range healthiness rating', () => {
    const bad = FoodAnalysisSchema.safeParse({
      food_name: 'Mystery',
      estimated_calories: 100,
      protein_g: 1,
      carbs_g: 1,
      fat_g: 1,
      healthiness_rating: 9,
      portion_recommendation: '',
      confidence: 'low',
      notes: '',
    });
    expect(bad.success).toBe(false);
  });

  it('analyze response carries provenance', () => {
    const r = AnalyzeFoodResponseSchema.safeParse({
      food_name: 'Apple',
      estimated_calories: 95,
      protein_g: 0,
      carbs_g: 25,
      fat_g: 0,
      healthiness_rating: 5,
      portion_recommendation: 'One medium apple.',
      confidence: 'high',
      notes: '',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });
    expect(r.success).toBe(true);
  });

  it('defaults macros to 0 on meal create', () => {
    const parsed = CreateMealSchema.parse({
      name: 'Coffee',
      calories: 2,
      type: 'breakfast',
      date: '2026-06-20',
    });
    expect(parsed.protein).toBe(0);
    expect(parsed.source).toBe('manual');
  });

  it('enforces ISO date format', () => {
    expect(IsoDateSchema.safeParse('2026-6-1').success).toBe(false);
    expect(IsoDateSchema.safeParse('2026-06-01').success).toBe(true);
  });

  it('forbids mixing date with range', () => {
    expect(MealQuerySchema.safeParse({ date: '2026-06-20', from: '2026-06-01' }).success).toBe(
      false,
    );
  });
});
