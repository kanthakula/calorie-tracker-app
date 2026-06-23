import { describe, expect, it } from 'vitest';
import { computeAdaptiveTDEE, computeStreak, computeTrend } from './adaptive.js';

function range(start: string, n: number): string[] {
  const out: string[] = [];
  let ms = Date.parse(start);
  for (let i = 0; i < n; i++) {
    out.push(new Date(ms).toISOString().slice(0, 10));
    ms += 86_400_000;
  }
  return out;
}

describe('computeTrend', () => {
  it('smooths toward the data', () => {
    const t = computeTrend([
      { date: '2026-06-01', weightKg: 80 },
      { date: '2026-06-02', weightKg: 84 },
      { date: '2026-06-03', weightKg: 80 },
    ]);
    expect(t[0]!.trendKg).toBe(80);
    // smoothed value stays between the extremes, not jumping to 84
    expect(t[1]!.trendKg).toBeGreaterThan(80);
    expect(t[1]!.trendKg).toBeLessThan(84);
  });
});

describe('computeAdaptiveTDEE', () => {
  it('returns null without enough data', () => {
    expect(computeAdaptiveTDEE({ days: [], weights: [] })).toBeNull();
  });

  it('infers expenditure from intake + weight trend (stable weight ≈ intake)', () => {
    const dates = range('2026-06-01', 21);
    const days = dates.map((date) => ({ date, intake: 2200 }));
    // Weight essentially flat → TDEE ≈ average intake.
    const weights = dates
      .filter((_, i) => i % 3 === 0)
      .map((date) => ({ date, weightKg: 80 }));
    const r = computeAdaptiveTDEE({ days, weights });
    expect(r).not.toBeNull();
    expect(Math.abs(r!.tdee - 2200)).toBeLessThan(50);
  });

  it('infers a higher TDEE when losing weight at fixed intake', () => {
    const dates = range('2026-06-01', 28);
    const days = dates.map((date) => ({ date, intake: 2000 }));
    // Lose ~1kg over 28 days → expenditure above intake.
    const weights = dates
      .filter((_, i) => i % 4 === 0)
      .map((date, i) => ({ date, weightKg: 80 - i * 0.14 }));
    const r = computeAdaptiveTDEE({ days, weights });
    expect(r).not.toBeNull();
    expect(r!.tdee).toBeGreaterThan(2000);
    expect(r!.weightChangeKgPerWeek).toBeLessThan(0);
  });
});

describe('computeStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(computeStreak(['2026-06-20', '2026-06-21', '2026-06-22'], '2026-06-22')).toBe(3);
  });
  it('breaks on a gap', () => {
    expect(computeStreak(['2026-06-19', '2026-06-22'], '2026-06-22')).toBe(1);
  });
  it('is zero when today is not logged', () => {
    expect(computeStreak(['2026-06-20'], '2026-06-22')).toBe(0);
  });
});
