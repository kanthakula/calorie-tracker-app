'use client';

import type { DailyTotals, Targets } from '@k21/validation';
import { MACRO_EMOJI } from '@/lib/emoji';
import styles from './MacroTiles.module.css';

interface Props {
  totals: DailyTotals;
  targets: Targets | null;
}

interface Row {
  key: 'protein' | 'carbs' | 'fat';
  label: string;
  value: number;
  target: number | null;
}

/**
 * Compact macro tiles: protein / carbs / fat with a progress bar toward target,
 * an emoji marker, and mono numbers. When no profile targets exist, the bars are
 * hidden and just the gram totals are shown.
 */
export function MacroTiles({ totals, targets }: Props) {
  const rows: Row[] = [
    {
      key: 'protein',
      label: 'Protein',
      value: totals.protein,
      target: targets?.proteinTarget ?? null,
    },
    {
      key: 'carbs',
      label: 'Carbs',
      value: totals.carbs,
      target: targets?.carbTarget ?? null,
    },
    {
      key: 'fat',
      label: 'Fat',
      value: totals.fat,
      target: targets?.fatTarget ?? null,
    },
  ];

  return (
    <section className={`card ${styles.card}`} aria-labelledby="macros-heading">
      <h2 id="macros-heading" className={styles.heading}>
        Macros
      </h2>
      <div className={styles.grid}>
        {rows.map((row) => {
          const hasTarget = row.target != null && row.target > 0;
          const pct = hasTarget
            ? Math.min(100, Math.round((row.value / (row.target as number)) * 100))
            : 0;
          const over = hasTarget && row.value > (row.target as number);
          return (
            <div key={row.key} className={styles.tile}>
              <div className={styles.tileHead}>
                <span className={styles.emoji} aria-hidden="true">
                  {MACRO_EMOJI[row.key]}
                </span>
                <span className={styles.label}>{row.label}</span>
              </div>
              <div className={styles.value}>
                <span className="num">{row.value.toLocaleString()}</span>
                <span className={styles.unit}>
                  {hasTarget ? (
                    <>
                      {' / '}
                      <span className="num">
                        {(row.target as number).toLocaleString()}
                      </span>
                      g
                    </>
                  ) : (
                    'g'
                  )}
                </span>
              </div>
              {hasTarget && (
                <div
                  className={styles.bar}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={row.target as number}
                  aria-valuenow={row.value}
                  aria-label={`${row.label} ${row.value} of ${row.target} grams`}
                >
                  <span
                    className={`${styles.fill} ${over ? styles.fillOver : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
