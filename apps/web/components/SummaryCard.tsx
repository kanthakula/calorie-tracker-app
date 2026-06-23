'use client';

import { useEffect, useState } from 'react';
import type { DailyTotals, DailyGoal, DailyEnergy } from '@k21/validation';
import { CalorieRing } from './CalorieRing';
import { MISC_EMOJI } from '@/lib/emoji';
import styles from './SummaryCard.module.css';

interface Props {
  totals: DailyTotals;
  goal: DailyGoal;
  /** Daily energy balance; used to credit workout burn toward "kcal left". */
  energy?: DailyEnergy | null;
  onSaveGoal: (calorieGoal: number) => Promise<void> | void;
}

/**
 * Hero tile: the Calorie Ring (net = consumed − burned, vs target) with the
 * remaining kcal big in the center, plus inline goal editing. When workouts have
 * burned calories, a small caption spells out the math beneath the ring.
 */
export function SummaryCard({ totals, goal, energy, onSaveGoal }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(goal.calorieGoal));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(String(goal.calorieGoal));
  }, [goal.calorieGoal]);

  const consumed = totals.calories;
  const target = goal.calorieGoal;
  const burned = energy?.burned ?? 0;
  const left = target - Math.max(0, consumed - burned);

  async function save() {
    const n = Number.parseInt(draft, 10);
    if (!Number.isFinite(n) || n < 0) return;
    setSaving(true);
    try {
      await onSaveGoal(n);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`card ${styles.card}`} aria-labelledby="summary-heading">
      <div className={styles.head}>
        <h2 id="summary-heading" className={styles.heading}>
          <span aria-hidden="true">{MISC_EMOJI.calories}</span> Today&apos;s energy
        </h2>
        {!editing && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setEditing(true)}
          >
            Edit goal
          </button>
        )}
      </div>

      <CalorieRing consumed={consumed} target={target} burned={burned} />

      {burned > 0 && (
        <p className={styles.math}>
          <span className="num">{target.toLocaleString()}</span> target{' '}
          <span aria-hidden="true">−</span>
          <span className="sr-only"> minus </span>{' '}
          <span className="num">{consumed.toLocaleString()}</span> eaten{' '}
          <span aria-hidden="true">+</span>
          <span className="sr-only"> plus </span>{' '}
          <span className="num">{burned.toLocaleString()}</span> burned{' '}
          <span aria-hidden="true">=</span>
          <span className="sr-only"> equals </span>{' '}
          <span className={`num ${styles.mathResult}`}>
            {left.toLocaleString()}
          </span>{' '}
          left
        </p>
      )}

      {editing ? (
        <div className={styles.goalEdit}>
          <label htmlFor="goal-input" className="sr-only">
            Calorie goal
          </label>
          <input
            id="goal-input"
            className="input"
            type="number"
            min={0}
            max={20000}
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
              if (e.key === 'Escape') setEditing(false);
            }}
            autoFocus
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void save()}
            disabled={saving}
          >
            Save
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </div>
      ) : (
        <p className={styles.goalNote}>
          Daily goal{' '}
          <span className="num">{target.toLocaleString()}</span> kcal
        </p>
      )}
    </section>
  );
}
