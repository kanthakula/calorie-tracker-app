// History tab: 7/14/30/All range toggle, a daily-calorie bar chart (Views only),
// and totals + per-day average.
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import type { Meal } from '@k21/validation';
import { ApiError, getMealsByRange } from '@/lib/api';
import { addDays, dateRange, todayIso } from '@/lib/date';
import { colors, font, radius, spacing } from '@/lib/theme';
import { BarChart, type BarDatum } from '@/components/BarChart';
import { Chip, ErrorText, Loading, SectionTitle } from '@/components/ui';
import { Empty } from '@/components/Empty';

type RangeKey = '7' | '14' | '30' | 'all';
const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: '7', label: '7 days', days: 7 },
  { key: '14', label: '14 days', days: 14 },
  { key: '30', label: '30 days', days: 30 },
  { key: 'all', label: 'All', days: 365 },
];

export default function HistoryScreen() {
  const [range, setRange] = useState<RangeKey>('7');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = RANGES.find((r) => r.key === range)?.days ?? 7;
  const to = todayIso();
  const from = addDays(to, -(days - 1));

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) setLoading(true);
      setError(null);
      try {
        const m = await getMealsByRange(from, to);
        setMeals(m);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return;
        setError(e instanceof Error ? e.message : 'Could not load history.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [from, to],
  );

  useFocusEffect(
    useCallback(() => {
      void load(true);
    }, [load]),
  );

  const { chartData, total, avg, activeDays } = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const m of meals) {
      byDate.set(m.date, (byDate.get(m.date) ?? 0) + m.calories);
    }
    const allDates = dateRange(from, to);
    const data: BarDatum[] = allDates.map((d) => ({
      date: d,
      calories: byDate.get(d) ?? 0,
    }));
    const sum = meals.reduce((acc, m) => acc + m.calories, 0);
    const logged = byDate.size;
    return {
      chartData: data,
      total: sum,
      avg: logged > 0 ? Math.round(sum / logged) : 0,
      activeDays: logged,
    };
  }, [meals, from, to]);

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
        <View style={styles.rangeRow}>
          {RANGES.map((r) => (
            <Chip
              key={r.key}
              label={r.label}
              selected={range === r.key}
              onPress={() => setRange(r.key)}
            />
          ))}
        </View>

        <ErrorText message={error} />

        {loading && meals.length === 0 ? (
          <Loading label="Loading history…" />
        ) : (
          <>
            <View style={styles.stats}>
              <Stat label="Total kcal" value={total.toLocaleString()} />
              <Stat label="Avg / active day" value={`${avg}`} />
              <Stat label="Active days" value={`${activeDays}`} />
            </View>

            <SectionTitle>Daily calories</SectionTitle>
            {meals.length === 0 ? (
              <Empty title="No meals in this range" hint="Log meals to see your trend." />
            ) : (
              <BarChart data={chartData} />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  rangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: { fontSize: font.h3, fontWeight: '800', color: colors.greenDark },
  statLabel: { fontSize: font.tiny, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
});
