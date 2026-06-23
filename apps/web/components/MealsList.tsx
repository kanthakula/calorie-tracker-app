'use client';

import { useState } from 'react';
import type { Meal, MealType } from '@k21/validation';
import { healthLabel } from '@/lib/health';
import { mealTypeEmoji } from '@/lib/emoji';
import styles from './MealsList.module.css';

interface Props {
  meals: Meal[];
  onDelete: (id: string) => Promise<void> | void;
  /** Hide the built-in heading when a collapsible Section already labels it. */
  headless?: boolean;
  /**
   * Diary mode: always render all four meal slots (even empty), each with a
   * "+ Add" button that opens the quick-add sheet pre-set to that slot.
   */
  diary?: boolean;
  onAddTo?: (type: MealType) => void;
}

const TYPE_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const TYPE_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};
const SOURCE_BADGE: Record<Meal['source'], string> = {
  manual: '✎',
  library: '📖',
  ai: '✨',
  recipe: '🍲',
};

export function MealsList({
  meals,
  onDelete,
  headless = false,
  diary = false,
  onAddTo,
}: Props) {
  const [leaving, setLeaving] = useState<Set<string>>(new Set());

  async function remove(id: string) {
    // Trigger leave animation, then delete after it plays.
    setLeaving((s) => new Set(s).add(id));
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = reduce ? 0 : 220;
    setTimeout(() => {
      void onDelete(id);
      setLeaving((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }, delay);
  }

  // Non-diary empty state keeps the simple "nothing yet" card.
  if (meals.length === 0 && !diary) {
    return (
      <section
        className="card"
        aria-labelledby={headless ? undefined : 'meals-heading'}
      >
        {!headless && <h2 id="meals-heading">Today&apos;s meals</h2>}
        <p className="subtle">
          Nothing logged yet. Add a meal, pick from the library, or snap a photo.
        </p>
      </section>
    );
  }

  // Diary mode shows every slot (even empty); otherwise only slots with items.
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    items: meals.filter((m) => m.type === type),
  })).filter((g) => diary || g.items.length > 0);

  return (
    <section
      className="card"
      aria-labelledby={headless ? undefined : 'meals-heading'}
    >
      {!headless && <h2 id="meals-heading">{diary ? 'Diary' : 'Meals'}</h2>}
      <div className={styles.groups}>
        {grouped.map((group) => {
          const groupCals = group.items.reduce((s, m) => s + m.calories, 0);
          return (
            <div key={group.type} className={styles.group}>
              <div className={styles.groupHead}>
                <h3 className={styles.groupTitle}>
                  <span aria-hidden="true">{mealTypeEmoji(group.type)}</span>{' '}
                  {TYPE_LABEL[group.type]}
                </h3>
                <span className={styles.groupMeta}>
                  {group.items.length > 0 && (
                    <span className="subtle">
                      <span className="num">{groupCals.toLocaleString()}</span>{' '}
                      kcal
                    </span>
                  )}
                  {diary && onAddTo && (
                    <button
                      type="button"
                      className={styles.addBtn}
                      onClick={() => onAddTo(group.type)}
                      aria-label={`Add to ${TYPE_LABEL[group.type]}`}
                    >
                      + Add
                    </button>
                  )}
                </span>
              </div>
              {group.items.length === 0 ? (
                <p className={styles.emptyHint}>Nothing logged yet.</p>
              ) : (
                <ul className={styles.list}>
                {group.items.map((meal) => {
                  const h = healthLabel(meal.health);
                  const isLeaving = leaving.has(meal.id);
                  return (
                    <li
                      key={meal.id}
                      className={`${styles.item} ${isLeaving ? styles.leaving : styles.entering}`}
                    >
                      <span
                        className={styles.source}
                        title={`Source: ${meal.source}`}
                        aria-hidden="true"
                      >
                        {SOURCE_BADGE[meal.source]}
                      </span>
                      <div className={styles.info}>
                        <span className={styles.name}>{meal.name}</span>
                        <span className="subtle">
                          P{meal.protein} · C{meal.carbs} · F{meal.fat}
                          {meal.health > 0 && (
                            <span className={`${styles.health} ${styles[`tone_${h.tone}`]}`}>
                              {' '}
                              · {h.label}
                            </span>
                          )}
                        </span>
                      </div>
                      <span className={styles.cals}>
                        {meal.calories.toLocaleString()}
                        <span className={styles.calsUnit}>kcal</span>
                      </span>
                      <button
                        type="button"
                        className={styles.del}
                        onClick={() => void remove(meal.id)}
                        aria-label={`Delete ${meal.name}`}
                      >
                        🗑
                      </button>
                    </li>
                  );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
