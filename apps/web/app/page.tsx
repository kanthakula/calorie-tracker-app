'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CreateMeal, Meal, MealType, Streak } from '@k21/validation';
import { RequireAuth } from '@/components/RequireAuth';
import { Header } from '@/components/Header';
import { OnboardingGate } from '@/components/OnboardingGate';
import { Section } from '@/components/Section';
import { DateNav } from '@/components/DateNav';
import { SummaryCard } from '@/components/SummaryCard';
import { MacroTiles } from '@/components/MacroTiles';
import { InsightCard } from '@/components/InsightCard';
import { AlertsCard } from '@/components/AlertsCard';
import { EnergyCard } from '@/components/EnergyCard';
import { Workouts } from '@/components/Workouts';
import { MealsList } from '@/components/MealsList';
import { WaterCard } from '@/components/WaterCard';
import { StreakBadge } from '@/components/StreakBadge';
import { TargetSourceBadge } from '@/components/TargetSourceBadge';
import { QuickAddSheet } from '@/components/QuickAddSheet';
import { useToast } from '@/components/useToast';
import type { MealSummary } from '@/lib/types';
import { useSettings } from '@/lib/settings';
import {
  getMealsByDate,
  getSummary,
  getStreak,
  createMeal as apiCreateMeal,
  deleteMeal as apiDeleteMeal,
  setGoal as apiSetGoal,
  ApiError,
} from '@/lib/api';
import { todayIso } from '@/lib/date';
import { getRemind, setRemind } from '@/lib/reminders';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <RequireAuth>
      <Header />
      <OnboardingGate />
      <Tracker />
    </RequireAuth>
  );
}

function Tracker() {
  const [date, setDate] = useState<string>(() => todayIso());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [summary, setSummary] = useState<MealSummary | null>(null);
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  // Quick-add sheet (opened by the bottom-nav FAB or a per-meal "+ Add").
  const [sheetOpen, setSheetOpen] = useState(false);
  // Reminders: client-only preference + a per-session dismiss for the banner.
  const [remind, setRemindState] = useState(false);
  const [reminderDismissed, setReminderDismissed] = useState(false);
  const { show, node: toast } = useToast();
  // Gate optional sections. While settings aren't ready, features default to ON
  // (see SettingsProvider fallbacks) so we never flash-hide existing UI.
  const { features } = useSettings();

  // The streak is anchored to the real "today", not the selected date.
  const refreshStreak = useCallback(async () => {
    try {
      setStreak(await getStreak(todayIso()));
    } catch {
      // Non-critical — leave the badge hidden on failure.
    }
  }, []);

  const refresh = useCallback(
    async (forDate: string) => {
      setLoading(true);
      setError(null);
      try {
        const [m, s] = await Promise.all([
          getMealsByDate(forDate),
          getSummary(forDate),
        ]);
        setMeals(m);
        setSummary(s);
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : 'Could not load your day.',
        );
      } finally {
        setLoading(false);
      }
      // Re-fetch the streak alongside the day (logging changes it).
      void refreshStreak();
    },
    [refreshStreak],
  );

  useEffect(() => {
    void refresh(date);
  }, [date, refresh]);

  // Load the reminder preference once on mount (client-only).
  useEffect(() => {
    setRemindState(getRemind());
  }, []);

  // Open the quick-add sheet from the FAB (same page) or on arrival from
  // another page (bottom-nav routes here with ?add=1).
  useEffect(() => {
    function onQuickAdd() {
      setSheetOpen(true);
    }
    window.addEventListener('k21:quickadd', onQuickAdd);
    const params = new URLSearchParams(window.location.search);
    if (params.has('add')) {
      setSheetOpen(true);
      // Clean the URL so a refresh doesn't reopen the sheet.
      window.history.replaceState(null, '', window.location.pathname);
    }
    return () => window.removeEventListener('k21:quickadd', onQuickAdd);
  }, []);

  function toggleRemind() {
    const next = !remind;
    setRemindState(next);
    setRemind(next);
  }

  function openSheet(slot?: MealType) {
    if (slot) setMealType(slot);
    setSheetOpen(true);
  }

  const showReminder =
    remind && !reminderDismissed && streak != null && !streak.loggedToday;

  const handleAdd = useCallback(
    async (meal: CreateMeal) => {
      try {
        await apiCreateMeal(meal);
        await refresh(date);
        show(`Added ${meal.name}`);
      } catch (err) {
        show(err instanceof ApiError ? err.message : 'Could not add meal');
        throw err;
      }
    },
    [date, refresh, show],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      // Optimistic removal; reconcile totals via refresh.
      setMeals((prev) => prev.filter((m) => m.id !== id));
      try {
        await apiDeleteMeal(id);
        await refresh(date);
        show('Meal removed');
      } catch {
        await refresh(date);
        show('Could not remove meal');
      }
    },
    [date, refresh, show],
  );

  const handleSaveGoal = useCallback(
    async (calorieGoal: number) => {
      try {
        // Persist as the standing/default goal (date: null) so it applies daily.
        await apiSetGoal(null, calorieGoal);
        await refresh(date);
        show('Goal updated');
      } catch {
        show('Could not update goal');
      }
    },
    [date, refresh, show],
  );

  const todayTotals =
    summary && summary.totals.calories > 0
      ? {
          calories: summary.totals.calories,
          protein: summary.totals.protein,
          carbs: summary.totals.carbs,
          fat: summary.totals.fat,
        }
      : null;

  return (
    <main className="app-main" id="main">
      <DateNav date={date} onChange={setDate} />

      <div className={styles.statusBar}>
        {streak && <StreakBadge streak={streak} />}
        <label className={styles.remindToggle}>
          <input type="checkbox" checked={remind} onChange={toggleRemind} />
          <span>Daily logging reminder</span>
        </label>
      </div>

      {showReminder && (
        <div className={styles.reminder} role="status">
          <span>Don&rsquo;t forget to log today 🍽️</span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setReminderDismissed(true)}
            aria-label="Dismiss reminder"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="card" role="alert">
          <p className="error-text">{error}</p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void refresh(date)}
          >
            Retry
          </button>
        </div>
      )}

      {summary && (
        <div className={styles.bento}>
          <div className={`${styles.cell} ${styles.hero}`}>
            {summary.targetSource && (
              <div className={styles.heroBadge}>
                <TargetSourceBadge source={summary.targetSource} />
              </div>
            )}
            <SummaryCard
              totals={summary.totals}
              goal={summary.goal}
              energy={summary.energy}
              onSaveGoal={handleSaveGoal}
            />
          </div>

          <div className={`${styles.cell} ${styles.macros}`}>
            <MacroTiles totals={summary.totals} targets={summary.targets} />
          </div>

          {features.workouts && summary.energy && (
            <div className={`${styles.cell} ${styles.energy}`}>
              <EnergyCard energy={summary.energy} />
            </div>
          )}

          {features.water && (
            <div className={`${styles.cell} ${styles.water}`}>
              <WaterCard
                date={date}
                ml={summary.water?.ml ?? 0}
                targetMl={summary.water?.targetMl ?? null}
                onChanged={refresh}
                notify={show}
              />
            </div>
          )}

          <div className={`${styles.cell} ${styles.insight}`}>
            <InsightCard insight={summary.insight} />
          </div>

          <div className={`${styles.cell} ${styles.alerts}`}>
            <AlertsCard
              targets={summary.targets}
              alerts={summary.alerts}
              totals={summary.totals}
            />
          </div>
        </div>
      )}

      {/* Meal-grouped diary — tap "+ Add" on a slot to log straight into it. */}
      {loading && !summary ? (
        <div className="card subtle">Loading your day…</div>
      ) : (
        <MealsList
          meals={meals}
          onDelete={handleDelete}
          diary
          onAddTo={openSheet}
        />
      )}

      {features.workouts && (
        <Section id="sec-workouts" title="Workouts" icon="🏋️" defaultOpen={false}>
          <Workouts
            date={date}
            workouts={summary?.workouts ?? []}
            onChanged={() => refresh(date)}
            notify={show}
            headless
          />
        </Section>
      )}

      <QuickAddSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        date={date}
        mealType={mealType}
        setMealType={setMealType}
        onAdd={handleAdd}
        todayTotals={todayTotals}
        features={{ aiSnap: features.aiSnap, foodLibrary: features.foodLibrary }}
        notify={show}
      />

      {toast}
    </main>
  );
}
