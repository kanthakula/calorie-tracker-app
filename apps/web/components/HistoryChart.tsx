'use client';

import { useState } from 'react';
import { shortDate, humanDate } from '@/lib/date';
import styles from './HistoryChart.module.css';

export interface DayBucket {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Props {
  data: DayBucket[];
  goal: number | null;
}

/**
 * Dependency-free bar chart of daily calories. Bars are flex divs; the goal line
 * is an absolutely-positioned rule. Each bar is a focusable button so the tooltip
 * is reachable by keyboard as well as hover.
 */
export function HistoryChart({ data, goal }: Props) {
  const [active, setActive] = useState<number | null>(null);

  const maxVal = Math.max(
    goal ?? 0,
    ...data.map((d) => d.calories),
    1,
  );

  const goalPct = goal && goal > 0 ? (goal / maxVal) * 100 : null;

  return (
    <div className={styles.chartWrap}>
      <div className={styles.plot} role="img" aria-label="Daily calories bar chart">
        {goalPct !== null && (
          <div
            className={styles.goalLine}
            style={{ bottom: `${goalPct}%` }}
            aria-hidden="true"
          >
            <span className={styles.goalTag}>goal {goal}</span>
          </div>
        )}

        <div className={styles.bars}>
          {data.map((d, i) => {
            const h = (d.calories / maxVal) * 100;
            const over = goal != null && goal > 0 && d.calories > goal;
            return (
              <button
                key={d.date}
                type="button"
                className={styles.barCol}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((cur) => (cur === i ? null : cur))}
                aria-label={`${humanDate(d.date)}: ${d.calories} kcal, protein ${d.protein}g, carbs ${d.carbs}g, fat ${d.fat}g`}
              >
                <span
                  className={`${styles.bar} ${over ? styles.barOver : ''}`}
                  style={{ height: `${Math.max(2, h)}%` }}
                />
                {active === i && (
                  <span className={styles.tooltip} role="status">
                    <strong>{humanDate(d.date)}</strong>
                    <span>{d.calories.toLocaleString()} kcal</span>
                    <span className="subtle">
                      P{d.protein} · C{d.carbs} · F{d.fat}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.axis} aria-hidden="true">
        {data.map((d, i) => (
          <span
            key={d.date}
            className={styles.tick}
            // Thin out labels on dense ranges to avoid overlap.
            style={{
              visibility:
                data.length <= 14 || i % Math.ceil(data.length / 14) === 0
                  ? 'visible'
                  : 'hidden',
            }}
          >
            {shortDate(d.date)}
          </span>
        ))}
      </div>
    </div>
  );
}
