'use client';

import { useState, type FormEvent } from 'react';
import type { CreateMeal, MealType } from '@k21/validation';
import { mealTypeEmoji } from '@/lib/emoji';
import styles from './AddMealForm.module.css';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

interface Props {
  date: string;
  onAdd: (meal: CreateMeal) => Promise<void> | void;
}

export function AddMealForm({ date, onAdd }: Props) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [type, setType] = useState<MealType>('lunch');
  const [showMacros, setShowMacros] = useState(false);
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function num(s: string): number {
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Give the meal a name.');
    const cals = num(calories);
    if (cals <= 0) return setError('Enter the calories for this meal.');

    const meal: CreateMeal = {
      name: name.trim(),
      calories: cals,
      type,
      date,
      protein: num(protein),
      carbs: num(carbs),
      fat: num(fat),
      health: 0,
      source: 'manual',
    };

    setBusy(true);
    try {
      await onAdd(meal);
      setName('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setShowMacros(false);
    } catch {
      setError('Could not add the meal. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="add-meal-heading">
      <h2 id="add-meal-heading">
        <span aria-hidden="true">📝</span> Add a meal
      </h2>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <div className={styles.grid}>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="meal-name">Name</label>
            <input
              id="meal-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Grilled chicken salad"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="meal-cal">Calories</label>
            <input
              id="meal-cal"
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="kcal"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="meal-type">Meal</label>
            <select
              id="meal-type"
              className="select"
              value={type}
              onChange={(e) => setType(e.target.value as MealType)}
            >
              {MEAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {mealTypeEmoji(t)} {t[0]!.toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {showMacros && (
          <div className={styles.grid}>
            <div className="field">
              <label htmlFor="meal-protein">Protein (g)</label>
              <input
                id="meal-protein"
                className="input"
                type="number"
                inputMode="numeric"
                min={0}
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="meal-carbs">Carbs (g)</label>
              <input
                id="meal-carbs"
                className="input"
                type="number"
                inputMode="numeric"
                min={0}
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="meal-fat">Fat (g)</label>
              <input
                id="meal-fat"
                className="input"
                type="number"
                inputMode="numeric"
                min={0}
                value={fat}
                onChange={(e) => setFat(e.target.value)}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowMacros((v) => !v)}
            aria-expanded={showMacros}
          >
            {showMacros ? 'Hide macros' : 'Add macros'}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Adding…' : 'Add meal'}
          </button>
        </div>
      </form>
    </section>
  );
}
