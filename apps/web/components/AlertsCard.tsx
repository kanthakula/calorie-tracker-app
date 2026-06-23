'use client';

import Link from 'next/link';
import type { Alert, DailyTotals, Targets } from '@k21/validation';
import { MACRO_EMOJI } from '@/lib/emoji';
import styles from './AlertsCard.module.css';

interface Props {
  targets: Targets | null;
  alerts: Alert[];
  totals: DailyTotals;
}

/** Map an alert level to a tone class. `under` reads as fine (on track / room to go). */
function toneFor(level: Alert['level']): string {
  switch (level) {
    case 'over':
      return styles.toneOver ?? '';
    case 'ok':
      return styles.toneOk ?? '';
    case 'under':
      return styles.toneUnder ?? '';
    default:
      return styles.toneInfo ?? '';
  }
}

/**
 * Surfaces personalized targets + alerts from the daily summary. When no targets
 * exist (profile not set up), shows a gentle prompt to set up the profile.
 */
export function AlertsCard({ targets, alerts, totals }: Props) {
  if (!targets) {
    return (
      <section className={`card ${styles.setup}`} aria-labelledby="targets-heading">
        <h2 id="targets-heading">Personalized targets</h2>
        <p className="muted">
          <Link href="/profile" className={styles.setupLink}>
            Set up your profile to get personalized targets →
          </Link>
        </p>
      </section>
    );
  }

  const macros: Array<{
    label: string;
    emoji: string;
    value: number;
    target: number;
    unit: string;
  }> = [
    {
      label: 'Protein',
      emoji: MACRO_EMOJI.protein,
      value: totals.protein,
      target: targets.proteinTarget,
      unit: 'g',
    },
    {
      label: 'Carbs',
      emoji: MACRO_EMOJI.carbs,
      value: totals.carbs,
      target: targets.carbTarget,
      unit: 'g',
    },
    {
      label: 'Fat',
      emoji: MACRO_EMOJI.fat,
      value: totals.fat,
      target: targets.fatTarget,
      unit: 'g',
    },
  ];

  return (
    <section className={`card ${styles.card}`} aria-labelledby="targets-heading">
      <h2 id="targets-heading">Personalized targets</h2>

      <div className={styles.macros}>
        {macros.map((m) => {
          const pct =
            m.target > 0 ? Math.min(100, Math.round((m.value / m.target) * 100)) : 0;
          const over = m.target > 0 && m.value > m.target;
          return (
            <div key={m.label} className={styles.macro}>
              <div className={styles.macroHead}>
                <span className={styles.macroLabel}>
                  <span aria-hidden="true">{m.emoji}</span> {m.label}
                </span>
                <span className={styles.macroValue}>
                  {m.value.toLocaleString()}
                  <span className={styles.macroTarget}>
                    {' / '}
                    {m.target.toLocaleString()}
                    {m.unit}
                  </span>
                </span>
              </div>
              <div
                className={styles.bar}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={m.target}
                aria-valuenow={m.value}
                aria-label={`${m.label} ${m.value} of ${m.target} ${m.unit}`}
              >
                <div
                  className={over ? styles.barFillOver : styles.barFill}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {alerts.length > 0 && (
        <ul className={styles.alerts} aria-label="Daily target checks">
          {alerts.map((a, i) => (
            <li key={`${a.metric}-${i}`} className={`${styles.alert} ${toneFor(a.level)}`}>
              <span className={styles.alertDot} aria-hidden="true" />
              <span>{a.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
