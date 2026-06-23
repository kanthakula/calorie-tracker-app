'use client';

import { useEffect, useState } from 'react';
import type { CreateMeal, Meal, MealType } from '@k21/validation';
import { getRecentMeals, ApiError } from '@/lib/api';
import { mealTypeEmoji } from '@/lib/emoji';
import styles from './RecentFoods.module.css';

interface Props {
  /** Selected date — re-logs land here. */
  date: string;
  /** Current meal slot — re-logged meals go to this slot. */
  mealType: MealType;
  /** Existing create-meal handler (refreshes + toasts upstream). */
  onAdd: (meal: CreateMeal) => Promise<void> | void;
}

/**
 * Horizontal row of recent meals for one-tap re-logging. Each chip carries the
 * meal's macros + health forward, retargeted to the selected date and current
 * meal slot. Source is preserved (so an AI-snapped meal stays "ai").
 */
export function RecentFoods({ date, mealType, onAdd }: Props) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getRecentMeals();
        if (!cancelled) setMeals(res);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : 'Could not load recent foods.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function relog(meal: Meal) {
    setPending(meal.id);
    const next: CreateMeal = {
      name: meal.name,
      calories: meal.calories,
      type: mealType,
      date,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      health: meal.health,
      source: meal.source,
    };
    try {
      await onAdd(next);
    } catch {
      /* upstream surfaces the error toast */
    } finally {
      setPending(null);
    }
  }

  if (loading) {
    return (
      <section className={`card ${styles.card}`} aria-labelledby="recent-heading">
        <h2 id="recent-heading" className={styles.heading}>
          <span aria-hidden="true">🔁</span> Recent foods
        </h2>
        <p className="subtle">Loading recent foods…</p>
      </section>
    );
  }

  if (error || meals.length === 0) {
    return (
      <section className={`card ${styles.card}`} aria-labelledby="recent-heading">
        <h2 id="recent-heading" className={styles.heading}>
          <span aria-hidden="true">🔁</span> Recent foods
        </h2>
        <p className="subtle">
          {error ?? 'Log a few meals and they’ll show up here for one-tap repeats.'}
        </p>
      </section>
    );
  }

  return (
    <section className={`card ${styles.card}`} aria-labelledby="recent-heading">
      <h2 id="recent-heading" className={styles.heading}>
        <span aria-hidden="true">🔁</span> Recent foods
      </h2>
      <p className="subtle">Tap to re-log to the selected day &amp; slot.</p>
      <ul className={styles.row} aria-label="Recent meals to re-log">
        {meals.map((meal) => (
          <li key={meal.id}>
            <button
              type="button"
              className={styles.chip}
              onClick={() => void relog(meal)}
              disabled={pending === meal.id}
              aria-label={`Re-log ${meal.name}, ${meal.calories} kcal`}
            >
              <span className={styles.chipEmoji} aria-hidden="true">
                {mealTypeEmoji(meal.type)}
              </span>
              <span className={styles.chipBody}>
                <span className={styles.chipName}>{meal.name}</span>
                <span className={styles.chipCals}>
                  <span className="num">{meal.calories.toLocaleString()}</span> kcal
                </span>
              </span>
              <span className={styles.chipPlus} aria-hidden="true">
                {pending === meal.id ? '…' : '+'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
