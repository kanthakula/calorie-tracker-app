import { describe, expect, it } from 'vitest';
import { computeTargets, resolveTargets, ProfileSchema } from './profile.js';

describe('computeTargets', () => {
  it('returns null without enough data', () => {
    expect(computeTargets({ age: null, sex: 'male', heightCm: null, currentWeightKg: null })).toBe(
      null,
    );
  });

  it('computes sensible targets for a sample male', () => {
    const t = computeTargets({
      age: 30,
      sex: 'male',
      heightCm: 178,
      currentWeightKg: 80,
      activityLevel: 'moderate',
      goal: 'maintain',
    });
    expect(t).not.toBeNull();
    // BMR ≈ 1755, TDEE ≈ 2720
    expect(t!.calorieTarget).toBeGreaterThan(2400);
    expect(t!.calorieTarget).toBeLessThan(3000);
    expect(t!.proteinTarget).toBe(128); // 1.6 * 80
    // macros should roughly add back to calories
    const kcal = t!.proteinTarget * 4 + t!.carbTarget * 4 + t!.fatTarget * 9;
    expect(Math.abs(kcal - t!.calorieTarget)).toBeLessThan(60);
  });

  it('applies a deficit for weight loss', () => {
    const maintain = computeTargets({
      age: 30,
      sex: 'female',
      heightCm: 165,
      currentWeightKg: 65,
      activityLevel: 'light',
      goal: 'maintain',
    })!;
    const lose = computeTargets({
      age: 30,
      sex: 'female',
      heightCm: 165,
      currentWeightKg: 65,
      activityLevel: 'light',
      goal: 'lose',
    })!;
    expect(maintain.calorieTarget - lose.calorieTarget).toBe(500);
  });

  it('resolveTargets prefers stored overrides when autoTargets is off', () => {
    const p = ProfileSchema.parse({
      age: 30,
      sex: 'male',
      heightCm: 178,
      currentWeightKg: 80,
      calorieTarget: 2500,
      autoTargets: false,
    });
    expect(resolveTargets(p)!.calorieTarget).toBe(2500);
  });

  it('resolveTargets follows the computed suggestion when autoTargets is on', () => {
    const p = ProfileSchema.parse({
      age: 30,
      sex: 'male',
      heightCm: 178,
      currentWeightKg: 80,
      calorieTarget: 2500, // ignored while auto is on
      autoTargets: true,
    });
    // computed maintenance target, not the stored 2500
    expect(resolveTargets(p)!.calorieTarget).not.toBe(2500);
  });
});
