import { describe, expect, it } from 'vitest';
import { targetsFromTDEE } from './profile.js';

const TDEE = 2500;
const KG = 80;

describe('diet-pattern macro splits', () => {
  it('keto keeps carbs very low', () => {
    const t = targetsFromTDEE(TDEE, 'maintain', KG, 'keto');
    expect(t.carbTarget).toBeLessThanOrEqual(35);
    expect(t.fatTarget).toBeGreaterThan(targetsFromTDEE(TDEE, 'maintain', KG, 'balanced').fatTarget);
  });

  it('high protein raises protein vs balanced', () => {
    const hp = targetsFromTDEE(TDEE, 'maintain', KG, 'high_protein');
    const bal = targetsFromTDEE(TDEE, 'maintain', KG, 'balanced');
    expect(hp.proteinTarget).toBeGreaterThan(bal.proteinTarget);
  });

  it('low carb caps carbs below balanced', () => {
    const lc = targetsFromTDEE(TDEE, 'maintain', KG, 'low_carb');
    const bal = targetsFromTDEE(TDEE, 'maintain', KG, 'balanced');
    expect(lc.carbTarget).toBeLessThan(bal.carbTarget);
  });

  it('every pattern roughly reconstructs the calorie target from macros', () => {
    for (const p of ['balanced', 'high_protein', 'low_carb', 'keto', 'mediterranean'] as const) {
      const t = targetsFromTDEE(TDEE, 'maintain', KG, p);
      const kcal = t.proteinTarget * 4 + t.carbTarget * 4 + t.fatTarget * 9;
      expect(Math.abs(kcal - t.calorieTarget)).toBeLessThan(80);
    }
  });
});
