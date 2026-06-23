'use client';

import { useEffect, useState } from 'react';
import type { CreateMeal, MealType } from '@k21/validation';
import { AiSnap } from './AiSnap';
import { AddMealForm } from './AddMealForm';
import { SavedMeals } from './SavedMeals';
import { FoodLibrary } from './FoodLibrary';
import { RecentFoods } from './RecentFoods';
import { RecipeLibrary } from './RecipeLibrary';
import { mealTypeEmoji } from '@/lib/emoji';
import styles from './QuickAddSheet.module.css';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

type TabKey = 'snap' | 'recent' | 'manual' | 'saved' | 'recipes' | 'library';
type Tab = { key: TabKey; label: string; icon: string };

type Totals = { calories: number; protein: number; carbs: number; fat: number };

export function QuickAddSheet({
  open,
  onClose,
  date,
  mealType,
  setMealType,
  onAdd,
  todayTotals,
  features,
  notify,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  mealType: MealType;
  setMealType: (t: MealType) => void;
  onAdd: (meal: CreateMeal) => Promise<void> | void;
  todayTotals: Totals | null;
  features: { aiSnap: boolean; foodLibrary: boolean };
  notify: (message: string) => void;
}) {
  const tabs: Tab[] = [
    ...(features.aiSnap
      ? [{ key: 'snap' as const, label: 'AI Snap', icon: '📷' }]
      : []),
    { key: 'recent', label: 'Recent', icon: '🔁' },
    { key: 'manual', label: 'Manual', icon: '✏️' },
    { key: 'saved', label: 'Saved', icon: '⭐' },
    { key: 'recipes', label: 'Recipes', icon: '🍲' },
    ...(features.foodLibrary
      ? [{ key: 'library' as const, label: 'Library', icon: '📚' }]
      : []),
  ];

  const [tab, setTab] = useState<TabKey>(tabs[0]?.key ?? 'manual');

  // Close on Escape and lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Add food"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.grip} aria-hidden="true" />

        <div className={styles.head}>
          <div className={styles.slotWrap}>
            <span className={styles.eyebrow}>Add to</span>
            <div className={styles.slots} role="group" aria-label="Meal slot">
              {MEAL_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="chip"
                  aria-pressed={mealType === t}
                  onClick={() => setMealType(t)}
                >
                  <span aria-hidden="true">{mealTypeEmoji(t)}</span>
                  {t[0]!.toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Add method">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
              onClick={() => setTab(t.key)}
            >
              <span aria-hidden="true">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {tab === 'snap' && features.aiSnap && (
            <AiSnap date={date} mealType={mealType} onAdd={onAdd} headless />
          )}
          {tab === 'recent' && (
            <RecentFoods date={date} mealType={mealType} onAdd={onAdd} />
          )}
          {tab === 'manual' && <AddMealForm date={date} onAdd={onAdd} />}
          {tab === 'recipes' && (
            <RecipeLibrary
              date={date}
              mealType={mealType}
              onAdd={onAdd}
              notify={notify}
            />
          )}
          {tab === 'saved' && (
            <SavedMeals
              date={date}
              mealType={mealType}
              onAdd={onAdd}
              notify={notify}
              todayTotals={todayTotals}
            />
          )}
          {tab === 'library' && features.foodLibrary && (
            <FoodLibrary date={date} mealType={mealType} onAdd={onAdd} />
          )}
        </div>
      </div>
    </div>
  );
}
