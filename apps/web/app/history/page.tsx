'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Meal } from '@k21/validation';
import { RequireAuth } from '@/components/RequireAuth';
import { Header } from '@/components/Header';
import { HistoryChart, type DayBucket } from '@/components/HistoryChart';
import { getMealsByRange, getGoal, ApiError } from '@/lib/api';
import { addDays, dateRange, todayIso } from '@/lib/date';
import styles from './history.module.css';

type RangeKey = '7d' | '14d' | '30d' | 'all';

const RANGE_DAYS: Record<Exclude<RangeKey, 'all'>, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
};

export default function HistoryPage() {
  return (
    <RequireAuth>
      <Header />
      <History />
    </RequireAuth>
  );
}

function History() {
  const [range, setRange] = useState<RangeKey>('7d');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [goal, setGoal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');

  const load = useCallback(async (key: RangeKey) => {
    setLoading(true);
    setError(null);
    const today = todayIso();
    // "All" pulls a wide year-long window; the API range is inclusive.
    const days = key === 'all' ? 365 : RANGE_DAYS[key];
    const start = addDays(today, -(days - 1));
    setFrom(start);
    setTo(today);
    try {
      const [m, g] = await Promise.all([
        getMealsByRange(start, today),
        getGoal(today).catch(() => null),
      ]);
      setMeals(m);
      setGoal(g?.calorieGoal ?? null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not load history.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [range, load]);

  // Bucket meals into a continuous per-day series (zero-filled).
  const buckets = useMemo<DayBucket[]>(() => {
    if (!from || !to) return [];
    const byDate = new Map<string, DayBucket>();
    for (const iso of dateRange(from, to)) {
      byDate.set(iso, { date: iso, calories: 0, protein: 0, carbs: 0, fat: 0 });
    }
    for (const m of meals) {
      const b = byDate.get(m.date);
      if (!b) continue;
      b.calories += m.calories;
      b.protein += m.protein;
      b.carbs += m.carbs;
      b.fat += m.fat;
    }
    return [...byDate.values()];
  }, [meals, from, to]);

  const stats = useMemo(() => {
    const totalCals = buckets.reduce((s, b) => s + b.calories, 0);
    const totalProtein = buckets.reduce((s, b) => s + b.protein, 0);
    const totalCarbs = buckets.reduce((s, b) => s + b.carbs, 0);
    const totalFat = buckets.reduce((s, b) => s + b.fat, 0);
    const loggedDays = buckets.filter((b) => b.calories > 0).length;
    const dayCount = buckets.length || 1;
    return {
      totalCals,
      totalProtein,
      totalCarbs,
      totalFat,
      loggedDays,
      avgPerDay: Math.round(totalCals / dayCount),
      avgPerLoggedDay: loggedDays ? Math.round(totalCals / loggedDays) : 0,
    };
  }, [buckets]);

  return (
    <main className="app-main" id="main">
      <h1 className={styles.title}>History</h1>

      <div className={styles.tabs} role="tablist" aria-label="History range">
        {(['7d', '14d', '30d', 'all'] as RangeKey[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={range === k}
            className="chip"
            aria-pressed={range === k}
            onClick={() => setRange(k)}
          >
            {k === 'all' ? 'All' : `Last ${RANGE_DAYS[k as Exclude<RangeKey, 'all'>]}d`}
          </button>
        ))}
      </div>

      {error && (
        <div className="card" role="alert">
          <p className="error-text">{error}</p>
          <button type="button" className="btn btn-ghost" onClick={() => void load(range)}>
            Retry
          </button>
        </div>
      )}

      <section className="card" aria-label="Daily calories chart">
        {loading ? (
          <p className="subtle">Loading history…</p>
        ) : buckets.length === 0 ? (
          <p className="subtle">No data for this range.</p>
        ) : (
          <HistoryChart data={buckets} goal={goal} />
        )}
      </section>

      <section className={styles.statGrid} aria-label="Range totals and averages">
        <StatCard label="Total calories" value={stats.totalCals.toLocaleString()} unit="kcal" />
        <StatCard label="Avg / day" value={stats.avgPerDay.toLocaleString()} unit="kcal" />
        <StatCard
          label="Avg / logged day"
          value={stats.avgPerLoggedDay.toLocaleString()}
          unit="kcal"
        />
        <StatCard label="Days logged" value={`${stats.loggedDays}`} unit={`of ${buckets.length}`} />
        <StatCard label="Total protein" value={stats.totalProtein.toLocaleString()} unit="g" />
        <StatCard label="Total carbs" value={stats.totalCarbs.toLocaleString()} unit="g" />
        <StatCard label="Total fat" value={stats.totalFat.toLocaleString()} unit="g" />
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className={`card ${styles.statCard}`}>
      <span className={styles.statValue}>
        {value} <span className={styles.statUnit}>{unit}</span>
      </span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
