'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { getWeights, logWeight, deleteWeight, ApiError } from '@/lib/api';
import type { WeightHistory } from '@/lib/types';
import { humanDate, shortDate } from '@/lib/date';
import styles from './WeightCard.module.css';

interface Props {
  /** Selected date — the weigh-in defaults to this date. */
  date: string;
  /** Re-fetch the daily summary after a change (adaptive TDEE may shift). */
  onChanged?: () => Promise<void> | void;
  /** Surface a toast message. */
  notify?: (message: string) => void;
}

/**
 * Weight log + smoothed trend. Shows the latest weigh-in, a 7-day trend change,
 * a dependency-free SVG chart (raw persimmon dots/line + smoothed lime trend
 * line), a quick "log weight" input, and per-day delete. Adaptive TDEE leans on
 * this data, so a change refreshes the summary.
 */
export function WeightCard({ date, onChanged, notify }: Props) {
  const [history, setHistory] = useState<WeightHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const h = await getWeights();
      setHistory(h);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load weight history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const n = Number.parseFloat(draft);
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter a weight in kg.');
      return;
    }
    setBusy(true);
    try {
      await logWeight({ date, weightKg: n });
      setDraft('');
      await load();
      await onChanged?.();
      notify?.(`Logged ${n} kg`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your weight.');
    } finally {
      setBusy(false);
    }
  }

  async function removeDay(d: string) {
    setBusy(true);
    try {
      await deleteWeight(d);
      await load();
      await onChanged?.();
      notify?.('Weigh-in removed');
    } catch {
      notify?.('Could not remove weigh-in');
    } finally {
      setBusy(false);
    }
  }

  const latest = history?.latestKg ?? null;
  const trend = history?.trend ?? [];
  const trendChange = trend.length >= 2 ? sevenDayTrendChange(trend) : null;
  const entries = history?.entries ?? [];

  return (
    <section className={`card ${styles.card}`} aria-labelledby="weight-heading">
      <div className={styles.head}>
        <h2 id="weight-heading" className={styles.heading}>
          <span aria-hidden="true">⚖️</span> Weight
        </h2>
        {latest != null && (
          <span className={styles.latest}>
            <span className={`num ${styles.latestVal}`}>{latest.toLocaleString()}</span>
            <span className={styles.latestUnit}>kg</span>
          </span>
        )}
      </div>

      {trendChange != null && (
        <p className={styles.trendNote}>
          7-day trend{' '}
          <span
            className={`num ${trendChange < 0 ? styles.down : trendChange > 0 ? styles.up : ''}`}
          >
            {trendChange > 0 ? '+' : ''}
            {trendChange.toFixed(2)}
          </span>{' '}
          kg{' '}
          <span className="subtle">
            {trendChange < 0 ? 'trending down' : trendChange > 0 ? 'trending up' : 'holding'}
          </span>
        </p>
      )}

      {loading && !history ? (
        <p className="subtle">Loading weight…</p>
      ) : entries.length === 0 ? (
        <p className={styles.empty}>
          No weigh-ins yet. Log your weight to see a smoothed trend and unlock measured
          (adaptive) calorie targets. 🌱
        </p>
      ) : (
        <WeightChart history={history!} onDelete={removeDay} busy={busy} />
      )}

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="weight-input">
            Log weight for {humanDate(date)} (kg)
          </label>
          <div className={styles.inputRow}>
            <input
              id="weight-input"
              className="input"
              type="number"
              inputMode="decimal"
              min={20}
              max={400}
              step="0.1"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="kg"
            />
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Log'}
            </button>
          </div>
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}

/** Change in the smoothed trend over (up to) the last 7 entries. */
function sevenDayTrendChange(trend: WeightHistory['trend']): number {
  const last = trend[trend.length - 1]!;
  const start = trend[Math.max(0, trend.length - 7)]!;
  return last.trendKg - start.trendKg;
}

/**
 * Dependency-free SVG line chart. Raw weigh-ins as a thin persimmon line + dots;
 * the smoothed trend as a thicker lime line. A scrubbable list of entries (with
 * delete) sits below so the data is keyboard-reachable.
 */
function WeightChart({
  history,
  onDelete,
  busy,
}: {
  history: WeightHistory;
  onDelete: (date: string) => void;
  busy: boolean;
}) {
  const { entries, trend } = history;
  // Combine raw + trend into a single value pool for the y-scale.
  const values = [
    ...entries.map((e) => e.weightKg),
    ...trend.map((t) => t.trendKg),
  ];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  // Padding so dots aren't clipped at the edges.
  const W = 100;
  const H = 40;
  const padY = 0.12;

  const x = (i: number, n: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => {
    const t = (v - min) / span; // 0..1, low at bottom
    return H - (padY * H + t * H * (1 - 2 * padY));
  };

  const rawPath = entries
    .map((e, i) => `${i === 0 ? 'M' : 'L'} ${x(i, entries.length).toFixed(2)} ${y(e.weightKg).toFixed(2)}`)
    .join(' ');
  const trendPath = trend
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i, trend.length).toFixed(2)} ${y(p.trendKg).toFixed(2)}`)
    .join(' ');

  // Show the most recent entries (newest last) in the delete list, capped.
  const recent = entries.slice(-8);

  return (
    <div className={styles.chartWrap}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Weight trend from ${humanDate(entries[0]!.date)} to ${humanDate(
          entries[entries.length - 1]!.date,
        )}. Latest ${entries[entries.length - 1]!.weightKg} kg.`}
      >
        {trend.length >= 2 && (
          <path d={trendPath} className={styles.trendLine} fill="none" />
        )}
        {entries.length >= 2 && (
          <path d={rawPath} className={styles.rawLine} fill="none" />
        )}
        {entries.map((e, i) => (
          <circle
            key={e.id}
            cx={x(i, entries.length)}
            cy={y(e.weightKg)}
            r={1.1}
            className={styles.dot}
          />
        ))}
      </svg>

      <div className={styles.legend} aria-hidden="true">
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchRaw}`} /> Weigh-ins
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchTrend}`} /> Trend
        </span>
      </div>

      <ul className={styles.entryList} aria-label="Recent weigh-ins">
        {recent.map((e) => (
          <li key={e.id} className={styles.entryItem}>
            <span className={styles.entryDate}>{shortDate(e.date)}</span>
            <span className={styles.entryVal}>
              <span className="num">{e.weightKg.toLocaleString()}</span> kg
            </span>
            <button
              type="button"
              className={styles.del}
              onClick={() => onDelete(e.date)}
              disabled={busy}
              aria-label={`Delete weigh-in for ${humanDate(e.date)}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
