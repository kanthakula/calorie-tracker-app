'use client';

import { useState } from 'react';
import { logWater, ApiError } from '@/lib/api';
import { MISC_EMOJI } from '@/lib/emoji';
import styles from './WaterCard.module.css';

interface Props {
  /** Selected date — water is logged here. */
  date: string;
  /** Today's hydration total (ml) from the day summary. */
  ml: number;
  /** Daily target (ml), or null if the profile has none. */
  targetMl: number | null;
  /** Reuse the page's refresh so the summary (incl. water) updates. */
  onChanged: (date: string) => Promise<void> | void;
  /** Toast notifier, same one other tiles receive. */
  notify: (message: string) => void;
}

const GLASS_ML = 250;

/**
 * Hydration tile 💧. Shows today's intake vs target as a ring with mono numbers,
 * plus quick-add buttons and a custom amount. All mutations route through the
 * page's `onChanged(date)` so the daily summary stays the source of truth.
 */
export function WaterCard({ date, ml, targetMl, onChanged, notify }: Props) {
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);

  const hasTarget = targetMl != null && targetMl > 0;
  const pct = hasTarget
    ? Math.min(100, Math.round((ml / (targetMl as number)) * 100))
    : 0;
  const reached = hasTarget && ml >= (targetMl as number);

  // SVG ring geometry.
  const R = 34;
  const C = 2 * Math.PI * R;
  const dash = hasTarget ? (pct / 100) * C : 0;

  async function apply(amount: number, mode: 'add' | 'set') {
    if (busy) return;
    setBusy(true);
    try {
      await logWater({ date, ml: amount, mode });
      await onChanged(date);
      if (mode === 'set' && amount === 0) notify('Water reset');
      else if (amount < 0) notify(`Removed ${Math.abs(amount)} ml`);
      else notify(`Added ${amount} ml 💧`);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not update water');
    } finally {
      setBusy(false);
    }
  }

  function submitCustom() {
    const n = Number.parseInt(custom, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    void apply(n, 'add');
    setCustom('');
  }

  return (
    <section className={`card ${styles.card}`} aria-labelledby="water-heading">
      <h2 id="water-heading" className={styles.heading}>
        <span aria-hidden="true">{MISC_EMOJI.water}</span> Hydration
      </h2>

      <div className={styles.ringRow}>
        <div className={styles.ringWrap} role="img" aria-label={waterLabel(ml, targetMl)}>
          <svg viewBox="0 0 80 80" className={styles.ring} aria-hidden="true">
            <circle
              cx="40"
              cy="40"
              r={R}
              className={styles.ringTrack}
              fill="none"
            />
            {hasTarget && (
              <circle
                cx="40"
                cy="40"
                r={R}
                className={`${styles.ringValue} ${reached ? styles.ringDone : ''}`}
                fill="none"
                strokeDasharray={`${dash} ${C}`}
                transform="rotate(-90 40 40)"
                strokeLinecap="round"
              />
            )}
          </svg>
          <span className={styles.ringCenter} aria-hidden="true">
            {hasTarget ? (
              <>
                <span className="num">{pct}</span>
                <span className={styles.ringPct}>%</span>
              </>
            ) : (
              <span className={styles.ringGlyph}>{MISC_EMOJI.water}</span>
            )}
          </span>
        </div>

        <div className={styles.figures}>
          <p className={styles.amount}>
            <span className="num">{ml.toLocaleString()}</span>
            <span className={styles.unit}>ml</span>
            {hasTarget && (
              <span className={styles.target}>
                {' / '}
                <span className="num">{(targetMl as number).toLocaleString()}</span> ml
              </span>
            )}
          </p>
          {hasTarget ? (
            <p className="subtle">
              {reached ? (
                <>Goal reached ✅</>
              ) : (
                <>
                  <span className="num">
                    {Math.max(0, (targetMl as number) - ml).toLocaleString()}
                  </span>{' '}
                  ml to go
                </>
              )}
            </p>
          ) : (
            <p className="subtle">
              Set a water target in your profile to track progress.
            </p>
          )}
        </div>
      </div>

      <div
        className={styles.quick}
        role="group"
        aria-label="Quick add water"
      >
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => void apply(GLASS_ML, 'add')}
          disabled={busy}
        >
          + Glass (250 ml)
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void apply(500, 'add')}
          disabled={busy}
        >
          + 500 ml
        </button>
      </div>

      <div className={styles.customRow}>
        <div className="field" style={{ flex: 1, gap: '0.2rem' }}>
          <label htmlFor="water-custom" className="sr-only">
            Custom amount in ml
          </label>
          <input
            id="water-custom"
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            max={5000}
            step={50}
            placeholder="Custom ml"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitCustom();
              }
            }}
          />
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={submitCustom}
          disabled={busy || !custom.trim()}
        >
          Add
        </button>
      </div>

      <div className={styles.undoRow}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void apply(-GLASS_ML, 'add')}
          disabled={busy || ml <= 0}
          aria-label="Undo one glass (remove 250 ml)"
        >
          − 250 ml
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void apply(0, 'set')}
          disabled={busy || ml <= 0}
        >
          Reset
        </button>
      </div>
    </section>
  );
}

function waterLabel(ml: number, targetMl: number | null): string {
  if (targetMl != null && targetMl > 0) {
    const pct = Math.min(100, Math.round((ml / targetMl) * 100));
    return `Hydration: ${ml} of ${targetMl} ml (${pct}%)`;
  }
  return `Hydration: ${ml} ml`;
}
