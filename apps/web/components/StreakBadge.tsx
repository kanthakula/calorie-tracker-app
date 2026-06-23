'use client';

import type { Streak } from '@k21/validation';
import { MISC_EMOJI } from '@/lib/emoji';
import styles from './StreakBadge.module.css';

interface Props {
  streak: Streak;
}

/**
 * Compact logging-streak badge. Shows "🔥 N day streak" and, when today is not
 * yet logged but a streak is alive, a gentle nudge to keep it going. Text-not-
 * color-only: the flame + words carry the meaning.
 */
export function StreakBadge({ streak }: Props) {
  const { current, loggedToday } = streak;
  if (current <= 0 && loggedToday) return null;

  return (
    <div className={styles.wrap} role="status">
      <span className={`${styles.badge} ${loggedToday ? styles.active : styles.idle}`}>
        <span aria-hidden="true">{MISC_EMOJI.streak}</span>
        {current > 0 ? (
          <span>
            <span className="num">{current}</span> day streak
          </span>
        ) : (
          <span>Start a streak</span>
        )}
      </span>
      {!loggedToday && current > 0 && (
        <span className={styles.hint}>log today to keep your streak</span>
      )}
    </div>
  );
}
