import { describe, expect, it } from 'vitest';
import { buildInsight, buildSuggestion } from './insight.service.js';
import type { DailyTotals } from '@k21/validation';

const totals = (over: Partial<DailyTotals> = {}): DailyTotals => ({
  date: '2026-06-20',
  calories: 1800,
  protein: 90,
  carbs: 180,
  fat: 60,
  mealCount: 3,
  avgHealth: 4,
  ...over,
});

describe('buildInsight', () => {
  it('reports on-track when under goal', () => {
    const i = buildInsight(totals({ calories: 1800 }), 2000);
    expect(i.remaining).toBe(200);
    expect(i.headline).toContain('On track');
  });

  it('reports over goal', () => {
    const i = buildInsight(totals({ calories: 2300 }), 2000);
    expect(i.headline).toContain('Over goal');
  });

  it('handles a day with no meals', () => {
    const i = buildInsight(totals({ calories: 0, mealCount: 0, protein: 0, avgHealth: 0 }), 2000);
    expect(i.headline).toContain('No meals');
  });
});

describe('buildSuggestion', () => {
  it('flags going well over goal', () => {
    expect(buildSuggestion({ consumed: 2400, goal: 2000, avgHealth: 4, protein: 90 })).toMatch(
      /ran over/i,
    );
  });
  it('flags low protein', () => {
    expect(buildSuggestion({ consumed: 1800, goal: 2000, avgHealth: 4, protein: 20 })).toMatch(
      /protein/i,
    );
  });
  it('flags unhealthy meals', () => {
    expect(buildSuggestion({ consumed: 1800, goal: 2000, avgHealth: 1.5, protein: 90 })).toMatch(
      /fruit or vegetable/i,
    );
  });
});
