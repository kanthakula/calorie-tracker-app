'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Streak } from '@k21/validation';
import { RequireAuth } from '@/components/RequireAuth';
import { Header } from '@/components/Header';
import { WeightCard } from '@/components/WeightCard';
import { WeeklyCheckin } from '@/components/WeeklyCheckin';
import { FastingCard } from '@/components/FastingCard';
import { StreakBadge } from '@/components/StreakBadge';
import { useToast } from '@/components/useToast';
import { getStreak } from '@/lib/api';
import { todayIso } from '@/lib/date';
import styles from './progress.module.css';

export default function ProgressPage() {
  return (
    <RequireAuth>
      <Header />
      <Progress />
    </RequireAuth>
  );
}

function Progress() {
  const today = todayIso();
  const [streak, setStreak] = useState<Streak | null>(null);
  const { show, node: toast } = useToast();

  const refreshStreak = useCallback(() => {
    getStreak(today)
      .then(setStreak)
      .catch(() => {
        // Non-critical — badge stays hidden on failure.
      });
  }, [today]);

  useEffect(() => {
    refreshStreak();
  }, [refreshStreak]);

  return (
    <main className="app-main" id="main">
      <h1 className={styles.title}>Progress</h1>
      {streak && <StreakBadge streak={streak} />}
      <FastingCard />
      <WeightCard date={today} onChanged={refreshStreak} notify={show} />
      <WeeklyCheckin weekEnd={today} />
      {toast}
    </main>
  );
}
