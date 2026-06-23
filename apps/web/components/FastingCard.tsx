'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FastingState } from '@k21/validation';
import { getFasting, startFast, endFast, ApiError } from '@/lib/api';
import styles from './FastingCard.module.css';

const PROTOCOLS = [
  { label: '16:8', hours: 16 },
  { label: '18:6', hours: 18 },
  { label: '20:4', hours: 20 },
  { label: 'OMAD', hours: 23 },
];

const STORAGE_KEY = 'k21:fastTarget';
const HOUR_MS = 3600 * 1000;

function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function fmtClock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function fmtRemaining(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/**
 * Intermittent-fasting timer ⏱️. Start a fast against a protocol (16:8 etc.),
 * watch the live elapsed time vs. target, and end it when you break the fast.
 * Shows a weekly adherence summary from recent completed fasts.
 */
export function FastingCard() {
  const [state, setState] = useState<FastingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState(16);
  const [now, setNow] = useState(() => Date.now());

  // Restore the last-used protocol (client preference).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const n = Number.parseInt(saved, 10);
        if (Number.isFinite(n)) setTarget(n);
      }
    } catch {
      // keep default
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setState(await getFasting());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load fasting.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Tick once a second while a fast is active so the readout stays live.
  useEffect(() => {
    if (!state?.active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state?.active]);

  async function onStart() {
    setBusy(true);
    try {
      await startFast(target);
      try {
        window.localStorage.setItem(STORAGE_KEY, String(target));
      } catch {
        /* non-critical */
      }
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start fast.');
    } finally {
      setBusy(false);
    }
  }

  async function onEnd() {
    setBusy(true);
    try {
      await endFast();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not end fast.');
    } finally {
      setBusy(false);
    }
  }

  const active = state?.active ?? null;

  // Weekly adherence from recent completed fasts.
  const weekAgo = now - 7 * 24 * HOUR_MS;
  const week = (state?.recent ?? []).filter(
    (s) => s.endAt && Date.parse(s.endAt) >= weekAgo,
  );
  const met = week.filter(
    (s) => Date.parse(s.endAt!) - Date.parse(s.startAt) >= s.targetHours * HOUR_MS,
  ).length;

  return (
    <section className={`card ${styles.card}`} aria-labelledby="fasting-heading">
      <h2 id="fasting-heading" className={styles.heading}>
        <span aria-hidden="true">⏱️</span> Fasting
      </h2>

      {loading ? (
        <p className="subtle">Loading…</p>
      ) : active ? (
        <ActiveFast
          startMs={Date.parse(active.startAt)}
          targetHours={active.targetHours}
          now={now}
          busy={busy}
          onEnd={onEnd}
        />
      ) : (
        <div className={styles.start}>
          <p className="subtle" style={{ marginTop: '-0.2rem' }}>
            Pick a protocol and start your fasting window.
          </p>
          <div
            className={styles.protocols}
            role="group"
            aria-label="Fasting protocol"
          >
            {PROTOCOLS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="chip"
                aria-pressed={target === p.hours}
                onClick={() => setTarget(p.hours)}
              >
                {p.label}
                <span className={styles.protoHours}>{p.hours}h</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void onStart()}
            disabled={busy}
          >
            {busy ? 'Starting…' : `Start ${target}h fast`}
          </button>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {week.length > 0 && (
        <div className={styles.week}>
          <span className={styles.weekLabel}>
            This week · <span className="num">{met}</span>/
            <span className="num">{week.length}</span> hit target
          </span>
          <div className={styles.bars} aria-hidden="true">
            {week.slice(0, 7).map((s) => {
              const hrs =
                (Date.parse(s.endAt!) - Date.parse(s.startAt)) / HOUR_MS;
              const hit = hrs >= s.targetHours;
              return (
                <span
                  key={s.id}
                  className={`${styles.bar} ${hit ? styles.barHit : ''}`}
                  title={`${hrs.toFixed(1)}h / ${s.targetHours}h target`}
                />
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function ActiveFast({
  startMs,
  targetHours,
  now,
  busy,
  onEnd,
}: {
  startMs: number;
  targetHours: number;
  now: number;
  busy: boolean;
  onEnd: () => void;
}) {
  const elapsed = Math.max(0, now - startMs);
  const targetMs = targetHours * HOUR_MS;
  const pct = Math.min(100, (elapsed / targetMs) * 100);
  const reached = elapsed >= targetMs;
  const remaining = targetMs - elapsed;

  return (
    <div className={styles.active}>
      <div className={styles.readout}>
        <span className={`num ${styles.elapsed}`}>{fmtDuration(elapsed)}</span>
        <span className={styles.elapsedUnit}>
          elapsed · {targetHours}h target
        </span>
      </div>

      <div
        className={styles.track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={targetHours}
        aria-valuenow={Math.round((elapsed / HOUR_MS) * 10) / 10}
        aria-label="Fasting progress"
      >
        <span
          className={`${styles.fill} ${reached ? styles.fillDone : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {reached ? (
        <p className={styles.reached}>
          🎉 Target reached — eating window is open.
        </p>
      ) : (
        <p className="subtle">
          <span className="num">{fmtRemaining(remaining)}</span> to go · goal at{' '}
          {fmtClock(startMs + targetMs)}
        </p>
      )}

      <p className={styles.since}>Fasting since {fmtClock(startMs)}</p>

      <button
        type="button"
        className="btn btn-ghost"
        onClick={onEnd}
        disabled={busy}
      >
        {busy ? 'Ending…' : 'End fast'}
      </button>
    </div>
  );
}
