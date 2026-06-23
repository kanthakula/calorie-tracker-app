'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  MET_ACTIVITIES,
  metFor,
  activityEmoji,
  computeBurn,
  type CreateWorkout,
  type Workout,
} from '@k21/validation';
import { getProfile, createWorkout, deleteWorkout } from '@/lib/api';
import styles from './Workouts.module.css';

interface Props {
  date: string;
  workouts: Workout[];
  /** Re-fetch the daily summary after a mutation (updates ring + energy + list). */
  onChanged: () => Promise<void> | void;
  /** Surface a toast message to the user. */
  notify: (message: string) => void;
  /** Hide the built-in heading when a collapsible Section already labels it. */
  headless?: boolean;
}

/** Default to "Running" — a common, clearly-named activity. */
const DEFAULT_ACTIVITY = 'running';

/**
 * Log workouts (MET-estimated or manual) and list today's workouts. Burn is
 * auto-estimated from the user's profile weight via computeBurn; when no weight
 * is set, the MET estimate is disabled and a manual calories entry is required.
 * Mutations call onChanged() so the ring + energy tile refresh.
 */
export function Workouts({
  date,
  workouts,
  onChanged,
  notify,
  headless = false,
}: Props) {
  const [weightKg, setWeightKg] = useState<number | null>(null);

  const [activity, setActivity] = useState<string>(DEFAULT_ACTIVITY);
  const [name, setName] = useState<string>('');
  // Whether the user has edited the name; if not, it tracks the activity name.
  const [nameTouched, setNameTouched] = useState(false);
  const [duration, setDuration] = useState('');
  const [manualCals, setManualCals] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());

  // Load the user's current weight once so MET burn can be estimated.
  useEffect(() => {
    let active = true;
    void getProfile()
      .then((res) => {
        if (active) setWeightKg(res.profile.currentWeightKg ?? null);
      })
      .catch(() => {
        if (active) setWeightKg(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const activityMeta = useMemo(
    () => MET_ACTIVITIES.find((a) => a.key === activity) ?? MET_ACTIVITIES[0],
    [activity],
  );

  const hasWeight = weightKg != null && weightKg > 0;
  const durationMin = Number.parseInt(duration, 10);
  const validDuration = Number.isFinite(durationMin) && durationMin > 0;

  // Live MET estimate (only meaningful when we have a weight + duration).
  const metEstimate =
    hasWeight && validDuration
      ? computeBurn(metFor(activity), weightKg, durationMin)
      : 0;

  const manualNum = Number.parseInt(manualCals, 10);
  const hasManual = Number.isFinite(manualNum) && manualNum > 0;

  // The effective name (defaults to the activity name until the user edits it).
  const effectiveName = nameTouched && name.trim() ? name.trim() : activityMeta.name;

  function onActivityChange(key: string) {
    setActivity(key);
    if (!nameTouched) setName('');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!validDuration) {
      setError('Enter a duration in minutes.');
      return;
    }

    // Manual override wins; otherwise use the MET estimate (needs a weight).
    let caloriesBurned: number;
    let source: CreateWorkout['source'];
    if (hasManual) {
      caloriesBurned = manualNum;
      source = 'manual';
    } else if (hasWeight && metEstimate > 0) {
      caloriesBurned = metEstimate;
      source = 'met';
    } else {
      setError(
        hasWeight
          ? 'Could not estimate burn — enter calories manually.'
          : 'Enter calories burned (no weight set to auto-estimate).',
      );
      return;
    }

    const workout: CreateWorkout = {
      name: effectiveName,
      activity,
      date,
      durationMin,
      caloriesBurned,
      source,
    };

    setBusy(true);
    try {
      await createWorkout(workout);
      await onChanged();
      notify(`Logged ${effectiveName}`);
      // Reset the form (keep the activity selection for quick repeat logging).
      setDuration('');
      setManualCals('');
      setName('');
      setNameTouched(false);
    } catch {
      setError('Could not log the workout. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, label: string) {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setLeaving((s) => new Set(s).add(id));
    const delay = reduce ? 0 : 200;
    setTimeout(() => {
      void (async () => {
        try {
          await deleteWorkout(id);
          await onChanged();
          notify(`Removed ${label}`);
        } catch {
          notify('Could not remove workout');
        } finally {
          setLeaving((s) => {
            const next = new Set(s);
            next.delete(id);
            return next;
          });
        }
      })();
    }, delay);
  }

  return (
    <section
      className={`card ${styles.card}`}
      aria-labelledby={headless ? undefined : 'workouts-heading'}
    >
      {!headless && (
        <h2 id="workouts-heading" className={styles.heading}>
          <span aria-hidden="true">🏃</span> Workouts
        </h2>
      )}

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <div className={styles.grid}>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="wo-activity">Activity</label>
            <select
              id="wo-activity"
              className="select"
              value={activity}
              onChange={(e) => onActivityChange(e.target.value)}
            >
              {MET_ACTIVITIES.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.emoji} {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="wo-name">Name</label>
            <input
              id="wo-name"
              className="input"
              value={nameTouched ? name : activityMeta.name}
              onChange={(e) => {
                setNameTouched(true);
                setName(e.target.value);
              }}
              placeholder={activityMeta.name}
            />
          </div>

          <div className="field">
            <label htmlFor="wo-duration">Duration (min)</label>
            <input
              id="wo-duration"
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              max={1440}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="min"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="wo-cals">
              Calories {hasWeight ? '(override)' : '(burned)'}
            </label>
            <input
              id="wo-cals"
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              max={20000}
              value={manualCals}
              onChange={(e) => setManualCals(e.target.value)}
              placeholder={hasWeight ? 'auto' : 'kcal'}
              required={!hasWeight}
              aria-describedby="wo-estimate"
            />
          </div>
        </div>

        <p id="wo-estimate" className={styles.estimate}>
          {hasWeight ? (
            hasManual ? (
              <>
                Logging{' '}
                <span className={`num ${styles.estVal}`}>
                  {manualNum.toLocaleString()}
                </span>{' '}
                kcal (manual)
              </>
            ) : (
              <>
                Estimated burn{' '}
                <span className={`num ${styles.estVal}`}>
                  {metEstimate.toLocaleString()}
                </span>{' '}
                kcal
                {!validDuration && (
                  <span className={styles.estHint}> — enter a duration</span>
                )}
              </>
            )
          ) : (
            <span className={styles.estHint}>
              Set your weight in Profile to auto-estimate burn, or enter calories
              manually.
            </span>
          )}
        </p>

        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Logging…' : 'Log workout'}
          </button>
        </div>
      </form>

      {workouts.length === 0 ? (
        <p className="subtle">No workouts logged. Add one to earn back calories. 🏃</p>
      ) : (
        <ul className={styles.list} aria-label="Today's workouts">
          {workouts.map((w) => {
            const isLeaving = leaving.has(w.id);
            return (
              <li
                key={w.id}
                className={`${styles.item} ${isLeaving ? styles.leaving : ''}`}
              >
                <span className={styles.itemEmoji} aria-hidden="true">
                  {activityEmoji(w.activity)}
                </span>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{w.name}</span>
                  <span className="subtle">
                    <span className="num">{w.durationMin}</span> min
                  </span>
                </div>
                <span className={styles.itemCals}>
                  <span className="num">{w.caloriesBurned.toLocaleString()}</span>
                  <span className={styles.itemUnit}>kcal</span>
                </span>
                <button
                  type="button"
                  className={styles.del}
                  onClick={() => void remove(w.id, w.name)}
                  aria-label={`Delete ${w.name}`}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
