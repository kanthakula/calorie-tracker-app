// A single meal in a list: name, type/source badges, calories, macros, health,
// and a delete button.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Meal } from '@k21/validation';
import { colors, font, radius, spacing } from '@/lib/theme';
import { HealthDots } from './HealthDots';

const SOURCE_LABEL: Record<Meal['source'], string> = {
  manual: 'Manual',
  library: 'Library',
  ai: 'AI',
};

export function MealRow({
  meal,
  onDelete,
  deleting = false,
}: {
  meal: Meal;
  onDelete: (meal: Meal) => void;
  deleting?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>
          {meal.name}
        </Text>
        <View style={styles.metaRow}>
          <Badge text={meal.type} />
          <Badge text={SOURCE_LABEL[meal.source]} subtle />
          {meal.health > 0 ? <HealthDots health={meal.health} /> : null}
        </View>
        <Text style={styles.macros}>
          P {meal.protein}g · C {meal.carbs}g · F {meal.fat}g
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.calories}>{meal.calories}</Text>
        <Text style={styles.kcal}>kcal</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${meal.name}`}
          onPress={() => onDelete(meal)}
          disabled={deleting}
          style={({ pressed }) => [styles.delete, pressed && styles.deletePressed]}
        >
          <Text style={styles.deleteText}>{deleting ? '…' : 'Delete'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Badge({ text, subtle = false }: { text: string; subtle?: boolean }) {
  return (
    <View style={[styles.badge, subtle && styles.badgeSubtle]}>
      <Text style={[styles.badgeText, subtle && styles.badgeTextSubtle]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  main: { flex: 1, gap: 4 },
  name: { fontSize: font.body, fontWeight: '700', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  macros: { fontSize: font.tiny, color: colors.textMuted },
  right: { alignItems: 'flex-end', justifyContent: 'space-between' },
  calories: { fontSize: font.h3, fontWeight: '800', color: colors.text },
  kcal: { fontSize: font.tiny, color: colors.textMuted, marginTop: -2 },
  delete: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
  },
  deletePressed: { opacity: 0.7 },
  deleteText: { color: colors.danger, fontSize: font.tiny, fontWeight: '700' },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.greenSoft,
  },
  badgeSubtle: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  badgeText: {
    fontSize: font.tiny,
    color: colors.greenDark,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  badgeTextSubtle: { color: colors.textMuted },
});
