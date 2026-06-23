'use client';

import { useEffect, useState } from 'react';
import type { WeeklyCheckin as WeeklyCheckinData } from '@k21/validation';
import { getWeekly, ApiError } from '@/lib/api';
import { humanDate } from '@/lib/date';
import styles from './WeeklyCheckin.module.css';

interface Props {
  /** The selected date — used as the week-ending date. */
  weekEnd: string;
}

/**
 * Weekly check-in card: days logged, average intake/burned/net, weight-trend
 * change, measured TDEE (if available), and a friendly summary message. Collapsible
 * so it stays out of the way on the tracker. Refreshes when the selected date moves.
 */
export function WeeklyCheckin({ weekEnd }: Props) {
  const [data, setData] = useState<WeeklyCheckinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getWeekly(weekEnd);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof ApiError ? err.message : 'Could not load your weekly check-in.',
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [weekEnd]);

  if (loading && !data) {
    return (
      <section className="card" aria-labelledby="weekly-heading">
        <h2 id="weekly-heading" className={styles.heading}>
          <span aria-hidden="true">🗓️</span> Weekly check-in
        </h2>
        <p className="subtle">Loading your week…</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="card" aria-labelledby="weekly-heading">
        <h2 id="weekly-heading" className={styles.heading}>
          <span aria-hidden="true">🗓️</span> Weekly check-in
        </h2>
        <p className="subtle">{error ?? 'No weekly data yet.'}</p>
      </section>
    );
  }

  const trendKg = data.weightTrendChangeKg;

  return (
    <section className={`card ${styles.card}`} aria-labelledby="weekly-heading">
      <div className={styles.head}>
        <h2 id="weekly-heading" className={styles.heading}>
          <span aria-hidden="true">🗓️</span> Weekly check-in
        </h2>
        <button
          type="button"
          className="btn btn-ghost"
          aria-expanded={open}
          aria-controls="weekly-body"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      <p className={styles.range}>
        {humanDate(data.weekStart)} – {humanDate(data.weekEnd)}
      </p>

      {open && (
        <div id="weekly-body" className={styles.body}>
          <div className={styles.grid}>
            <Stat
              label="Days logged"
              value={`${data.daysLogged}/7`}
              tone={data.daysLogged >= 5 ? 'good' : data.daysLogged >= 3 ? 'mid' : 'low'}
            />
            <Stat label="Avg intake" value={data.avgIntake.toLocaleString()} unit="kcal" />
            <Stat label="Avg burned" value={data.avgBurned.toLocaleString()} unit="kcal" />
            {data.avgNet != null && (
              <Stat
                label="Avg net"
                value={`${data.avgNet > 0 ? '+' : ''}${data.avgNet.toLocaleString()}`}
                unit="kcal"
                tone={data.avgNet < 0 ? 'good' : 'mid'}
              />
            )}
            {trendKg != null && (
              <Stat
                label="Weight trend"
                value={`${trendKg > 0 ? '+' : ''}${trendKg.toFixed(2)}`}
                unit="kg"
                tone={trendKg < 0 ? 'good' : trendKg > 0 ? 'mid' : undefined}
              />
            )}
            {data.adaptiveTdee && (
              <Stat
                label="Measured TDEE"
                value={data.adaptiveTdee.tdee.toLocaleString()}
                unit="kcal"
              />
            )}
          </div>

          <p className={styles.message}>{data.message}</p>
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'good' | 'mid' | 'low';
}) {
  return (
    <div className={styles.stat}>
      <span
        className={`num ${styles.statValue} ${
          tone === 'good' ? styles.good : tone === 'low' ? styles.low : ''
        }`}
      >
        {value}
        {unit && <span className={styles.statUnit}>{unit}</span>}
      </span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
