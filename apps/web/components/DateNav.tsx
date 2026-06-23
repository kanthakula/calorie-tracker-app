'use client';

import { addDays, humanDate, todayIso } from '@/lib/date';
import styles from './DateNav.module.css';

interface Props {
  date: string;
  onChange: (date: string) => void;
}

export function DateNav({ date, onChange }: Props) {
  const isToday = date === todayIso();

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>
        <h1 className={styles.heading}>{humanDate(date)}</h1>
        {!isToday && (
          <button
            type="button"
            className={styles.todayBtn}
            onClick={() => onChange(todayIso())}
          >
            Jump to today
          </button>
        )}
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => onChange(addDays(date, -1))}
          aria-label="Previous day"
        >
          ‹
        </button>

        <label className="sr-only" htmlFor="date-picker">
          Choose a date
        </label>
        <input
          id="date-picker"
          className={styles.picker}
          type="date"
          value={date}
          max={todayIso()}
          onChange={(e) => e.target.value && onChange(e.target.value)}
        />

        <button
          type="button"
          className={styles.navBtn}
          onClick={() => onChange(addDays(date, 1))}
          aria-label="Next day"
          disabled={isToday}
        >
          ›
        </button>
      </div>
    </div>
  );
}
