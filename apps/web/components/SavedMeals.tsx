'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type {
  CreateMeal,
  CreateSavedMeal,
  MealType,
  SavedMeal,
} from '@k21/validation';
import {
  getSavedMeals,
  createSavedMeal,
  deleteSavedMeal,
  ApiError,
} from '@/lib/api';
import styles from './SavedMeals.module.css';

interface Props {
  /** Selected date — logged saved meals land here. */
  date: string;
  /** Current meal slot — logged saved meals go to this slot. */
  mealType: MealType;
  /** Existing create-meal handler (refreshes + toasts upstream). */
  onAdd: (meal: CreateMeal) => Promise<void> | void;
  /** Toast notifier. */
  notify: (message: string) => void;
  /**
   * Optional shortcut: today's running totals so the user can save them as a
   * meal in one tap. Omitted when there's nothing logged.
   */
  todayTotals?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null;
}

interface FormState {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  health: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  health: '',
};

function toNum(s: string, fallback = 0): number {
  const n = Number.parseInt(s.trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Saved meals / recipes 🍱. Tapping a chip logs it to the selected date + slot
 * via the shared create-meal handler; a small form saves new bundles, and each
 * chip has a delete affordance.
 */
export function SavedMeals({ date, mealType, onAdd, notify, todayTotals }: Props) {
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getSavedMeals();
        if (!cancelled) setMeals(res);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof ApiError ? err.message : 'Could not load saved meals.',
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function logMeal(m: SavedMeal) {
    setPending(m.id);
    const next: CreateMeal = {
      name: m.name,
      calories: m.calories,
      type: mealType,
      date,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
      health: m.health,
      source: 'manual',
    };
    try {
      await onAdd(next);
    } catch {
      /* upstream surfaces the error toast */
    } finally {
      setPending(null);
    }
  }

  async function remove(m: SavedMeal) {
    try {
      await deleteSavedMeal(m.id);
      setMeals((prev) => prev.filter((x) => x.id !== m.id));
      notify(`Removed ${m.name}`);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not remove saved meal');
    }
  }

  async function saveNew(payload: CreateSavedMeal) {
    setSaving(true);
    try {
      const created = await createSavedMeal(payload);
      setMeals((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      notify(`Saved ${created.name}`);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not save meal');
    } finally {
      setSaving(false);
    }
  }

  function submitForm(e: FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const calories = toNum(form.calories);
    if (!name || calories <= 0) {
      notify('A saved meal needs a name and calories.');
      return;
    }
    void saveNew({
      name,
      calories,
      protein: toNum(form.protein),
      carbs: toNum(form.carbs),
      fat: toNum(form.fat),
      health: Math.min(5, toNum(form.health)),
    });
  }

  function saveFromToday() {
    if (!todayTotals || todayTotals.calories <= 0) return;
    void saveNew({
      name: `Meal on ${date}`,
      calories: todayTotals.calories,
      protein: todayTotals.protein,
      carbs: todayTotals.carbs,
      fat: todayTotals.fat,
      health: 0,
    });
  }

  const canSaveToday = !!todayTotals && todayTotals.calories > 0;

  return (
    <section className={`card ${styles.card}`} aria-labelledby="saved-heading">
      <div className={styles.head}>
        <h2 id="saved-heading" className={styles.heading}>
          <span aria-hidden="true">🍱</span> Saved meals
        </h2>
        <div className={styles.headActions}>
          {canSaveToday && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={saveFromToday}
              disabled={saving}
            >
              Save today&rsquo;s totals
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowForm((s) => !s)}
            aria-expanded={showForm}
          >
            {showForm ? 'Close' : '＋ Save a meal'}
          </button>
        </div>
      </div>

      <p className="subtle" style={{ marginTop: '-0.3rem' }}>
        Tap a meal to log it to the selected day &amp; slot.
      </p>

      {showForm && (
        <form className={styles.form} onSubmit={submitForm}>
          <div className="field" style={{ gap: '0.2rem' }}>
            <label htmlFor="saved-name">Name</label>
            <input
              id="saved-name"
              className="input"
              maxLength={80}
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Chicken & rice bowl"
            />
          </div>
          <div className={styles.formGrid}>
            <FormNum
              id="saved-cal"
              label="Calories"
              value={form.calories}
              onChange={(v) => setField('calories', v)}
            />
            <FormNum
              id="saved-protein"
              label="Protein (g)"
              value={form.protein}
              onChange={(v) => setField('protein', v)}
            />
            <FormNum
              id="saved-carbs"
              label="Carbs (g)"
              value={form.carbs}
              onChange={(v) => setField('carbs', v)}
            />
            <FormNum
              id="saved-fat"
              label="Fat (g)"
              value={form.fat}
              onChange={(v) => setField('fat', v)}
            />
            <FormNum
              id="saved-health"
              label="Health (0–5)"
              value={form.health}
              max={5}
              onChange={(v) => setField('health', v)}
            />
          </div>
          <div className={styles.formActions}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save meal'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="subtle">Loading saved meals…</p>
      ) : error ? (
        <p className="subtle">{error}</p>
      ) : meals.length === 0 ? (
        <p className="subtle">
          No saved meals yet — save a go-to meal and log it in one tap.
        </p>
      ) : (
        <ul className={styles.list} aria-label="Saved meals">
          {meals.map((m) => (
            <li key={m.id} className={styles.item}>
              <button
                type="button"
                className={styles.chip}
                onClick={() => void logMeal(m)}
                disabled={pending === m.id}
                aria-label={`Log ${m.name}, ${m.calories} kcal`}
              >
                <span className={styles.chipBody}>
                  <span className={styles.chipName}>{m.name}</span>
                  <span className={styles.chipMacros}>
                    <span className="num">{m.calories.toLocaleString()}</span> kcal
                    <span className={styles.dot} aria-hidden="true">
                      ·
                    </span>
                    <span className="num">{m.protein}</span>P
                    <span className="num">{m.carbs}</span>C
                    <span className="num">{m.fat}</span>F
                  </span>
                </span>
                <span className={styles.chipPlus} aria-hidden="true">
                  {pending === m.id ? '…' : '+'}
                </span>
              </button>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => void remove(m)}
                aria-label={`Delete saved meal ${m.name}`}
                title="Delete"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FormNum({
  id,
  label,
  value,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  max?: number;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field" style={{ gap: '0.2rem' }}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
