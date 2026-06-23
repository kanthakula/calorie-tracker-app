'use client';

import type { DailyInsight } from '@/lib/types';
import { MISC_EMOJI } from '@/lib/emoji';
import styles from './InsightCard.module.css';

export function InsightCard({ insight }: { insight: DailyInsight }) {
  const avg = insight.avgHealth;
  const stars = Math.round(avg);

  return (
    <section className={`card ${styles.card}`} aria-labelledby="insight-heading">
      <div className={styles.row}>
        <span className={styles.icon} aria-hidden="true">
          {MISC_EMOJI.insight}
        </span>
        <div className={styles.body}>
          <h2 id="insight-heading" className={styles.headline}>
            {insight.headline}
          </h2>
          <p className={styles.suggestion}>{insight.suggestion}</p>
          <div
            className={styles.health}
            aria-label={`Average healthiness ${avg.toFixed(1)} out of 5`}
          >
            <span className={styles.stars} aria-hidden="true">
              {'★'.repeat(stars)}
              {'☆'.repeat(Math.max(0, 5 - stars))}
            </span>
            <span className="subtle">
              avg healthiness {avg > 0 ? avg.toFixed(1) : '—'}/5
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
