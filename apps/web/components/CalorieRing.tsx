'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './CalorieRing.module.css';

interface Props {
  /** Calories consumed today. */
  consumed: number;
  /** Daily calorie target. */
  target: number;
  /** Calories burned via workouts. 0 for now; wired for a later sprint. */
  burned?: number;
}

/**
 * The signature element: a circular SVG progress ring showing net calories
 * (consumed − burned) against the target. The persimmon arc fills clockwise;
 * once net exceeds target the overshoot is drawn as a second arc in --over.
 * The remaining kcal sits big in the center in the mono "instrument" font.
 *
 * A subtle one-time fill animation plays on mount (skipped under
 * prefers-reduced-motion). The ring is decorative (aria-hidden); an accessible
 * text alternative is rendered alongside for assistive tech.
 */
export function CalorieRing({ consumed, target, burned = 0 }: Props) {
  const net = Math.max(0, consumed - burned);
  const remaining = target - net;
  const over = target > 0 && net > target;

  // Fraction of the target consumed (0..1), and the over-fraction beyond it.
  const baseFrac = target > 0 ? Math.min(1, net / target) : 0;
  const overFrac = over ? Math.min(1, (net - target) / target) : 0;

  // Geometry.
  const size = 240;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;

  // Mount animation: start from 0 and grow to the target fraction once.
  const [progress, setProgress] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setProgress(1);
      return;
    }
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // Re-run the fill when the underlying numbers change meaningfully.
  }, [net, target]);

  const baseDash = c * baseFrac * progress;
  const overDash = c * overFrac * progress;

  const centerLabel = over
    ? Math.abs(remaining).toLocaleString()
    : remaining.toLocaleString();
  const centerCaption = over ? 'kcal over' : 'kcal left';

  return (
    <div className={styles.wrap}>
      <div className={styles.ringBox} style={{ width: size, height: size }}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          aria-hidden="true"
          focusable="false"
        >
          {/* Track */}
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth={stroke}
          />
          {/* Consumed arc (persimmon) */}
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${baseDash} ${c}`}
            transform={`rotate(-90 ${center} ${center})`}
          />
          {/* Overshoot arc (--over), drawn on top from the start */}
          {over && (
            <circle
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke="var(--over)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${overDash} ${c}`}
              transform={`rotate(-90 ${center} ${center})`}
            />
          )}
        </svg>

        <div className={styles.center} aria-hidden="true">
          <span className={`num ${styles.bigNum} ${over ? styles.over : ''}`}>
            {centerLabel}
          </span>
          <span className={styles.caption}>{centerCaption}</span>
        </div>
      </div>

      <div className={styles.legend} aria-hidden="true">
        <span className={`num ${styles.legendVal}`}>{net.toLocaleString()}</span>
        <span className={styles.legendSep}>/</span>
        <span className={`num ${styles.legendTarget}`}>
          {target.toLocaleString()}
        </span>
        <span className={styles.legendUnit}>kcal</span>
      </div>

      {/* Accessible text alternative for the whole ring. */}
      <p className="sr-only">
        {`${net.toLocaleString()} of ${target.toLocaleString()} kcal consumed${
          burned > 0 ? ` (after ${burned.toLocaleString()} burned)` : ''
        }. ${
          over
            ? `${Math.abs(remaining).toLocaleString()} kcal over target.`
            : `${remaining.toLocaleString()} kcal remaining.`
        }`}
      </p>
    </div>
  );
}
