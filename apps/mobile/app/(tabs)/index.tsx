// Today tab: date selector, daily summary (calories vs goal + editable goal),
// insight card, and the day's meals with delete + pull-to-refresh.
import React, { useCallback, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import type { Meal } from '@k21/validation';
import type { MealSummary } from '@/lib/types';
import {
  ApiError,
  deleteMeal as apiDeleteMeal,
  getMealsByDate,
  getSummary,
  setGoal,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSelectedDate } from '@/lib/useToday';
import { colors, font, spacing } from '@/lib/theme';
import { DateSelector } from '@/components/DateSelector';
import { SummaryCard } from '@/components/SummaryCard';
import { InsightCard } from '@/components/InsightCard';
import { MealRow } from '@/components/MealRow';
import { Empty } from '@/components/Empty';
import { Button, ErrorText, Loading, SectionTitle } from '@/components/ui';

export default function TodayScreen() {
  const { user, signOut } = useAuth();
  const [date, setDate] = useSelectedDate();
  const [summary, setSummary] = useState<MealSummary | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) setLoading(true);
      setError(null);
      try {
        const [s, m] = await Promise.all([getSummary(date), getMealsByDate(date)]);
        setSummary(s);
        setMeals(m);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return; // gate handles redirect
        setError(e instanceof Error ? e.message : 'Could not load your day.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [date],
  );

  // Reload whenever the tab gains focus or the date changes (so meals added on
  // the Add/Snap tabs show up immediately).
  useFocusEffect(
    useCallback(() => {
      void load(true);
    }, [load]),
  );

  async function onSaveGoal(calorieGoal: number) {
    await setGoal(date, calorieGoal);
    await load(false);
  }

  function confirmDelete(meal: Meal) {
    Alert.alert('Delete meal', `Remove "${meal.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void doDelete(meal),
      },
    ]);
  }

  async function doDelete(meal: Meal) {
    setDeletingId(meal.id);
    try {
      await apiDeleteMeal(meal.id);
      await load(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete meal.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(false);
            }}
            tintColor={colors.green}
          />
        }
      >
        <View style={styles.greetingRow}>
          <Text style={styles.greeting}>Hi {user?.name ?? 'there'} 👋</Text>
          <Button label="Sign out" variant="ghost" onPress={() => void signOut()} />
        </View>

        <DateSelector date={date} onChange={setDate} />

        <ErrorText message={error} />

        {loading && !summary ? (
          <Loading label="Loading your day…" />
        ) : (
          <>
            {summary ? (
              <>
                <SummaryCard
                  totals={summary.totals}
                  goal={summary.goal}
                  onSaveGoal={onSaveGoal}
                />
                <InsightCard insight={summary.insight} />
              </>
            ) : null}

            <View style={styles.mealsHeader}>
              <SectionTitle>Meals</SectionTitle>
              <Text style={styles.count}>{meals.length}</Text>
            </View>

            {meals.length === 0 ? (
              <Empty
                title="No meals logged"
                hint="Add a meal from the Add or Snap tab to start tracking."
              />
            ) : (
              <View style={styles.mealList}>
                {meals.map((meal) => (
                  <MealRow
                    key={meal.id}
                    meal={meal}
                    onDelete={confirmDelete}
                    deleting={deletingId === meal.id}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  greetingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { fontSize: font.h2, fontWeight: '800', color: colors.text },
  mealsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  count: {
    fontSize: font.small,
    color: colors.greenDark,
    fontWeight: '700',
    backgroundColor: colors.greenSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  mealList: { gap: spacing.sm },
});
