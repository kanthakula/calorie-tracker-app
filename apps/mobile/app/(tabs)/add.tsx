// Add tab: manual add form + food-library picker. Both add to the currently
// selected day (shared with the Today tab).
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CreateMeal } from '@k21/validation';
import { createMeal } from '@/lib/api';
import { useSelectedDate } from '@/lib/useToday';
import { relativeDate } from '@/lib/date';
import { colors, font, spacing } from '@/lib/theme';
import { AddMealForm } from '@/components/AddMealForm';
import { FoodPicker } from '@/components/FoodPicker';

export default function AddScreen() {
  const [date] = useSelectedDate();
  const [toast, setToast] = useState<string | null>(null);

  async function add(meal: CreateMeal) {
    await createMeal(meal);
    setToast(`Added "${meal.name}"`);
    Alert.alert('Added', `"${meal.name}" was added to ${relativeDate(meal.date)}.`);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.context}>
          Adding to <Text style={styles.contextStrong}>{relativeDate(date)}</Text>
        </Text>
        {toast ? <Text style={styles.toast}>{toast}</Text> : null}
        <AddMealForm date={date} onAdd={add} />
        <FoodPicker date={date} onAdd={add} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  context: { fontSize: font.small, color: colors.textMuted },
  contextStrong: { color: colors.greenDark, fontWeight: '700' },
  toast: { fontSize: font.small, color: colors.greenDark, fontWeight: '600' },
});
