// Daily summary: calories vs goal with a progress bar, remaining, P/C/F totals,
// and an inline editable goal.
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { DailyGoal, DailyTotals } from '@k21/validation';
import { colors, font, radius, spacing } from '@/lib/theme';
import { Button, Card } from './ui';
import { ProgressBar } from './ProgressBar';

export function SummaryCard({
  totals,
  goal,
  onSaveGoal,
}: {
  totals: DailyTotals;
  goal: DailyGoal;
  onSaveGoal: (calorieGoal: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(goal.calorieGoal));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(String(goal.calorieGoal));
  }, [goal.calorieGoal]);

  const remaining = goal.calorieGoal - totals.calories;

  async function save() {
    const parsed = parseInt(draft, 10);
    if (Number.isNaN(parsed) || parsed < 0) return;
    setSaving(true);
    try {
      await onSaveGoal(parsed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.calories}>{totals.calories}</Text>
          <Text style={styles.caloriesLabel}>
            of {goal.calorieGoal} kcal goal
          </Text>
        </View>
        <View style={styles.remainingBox}>
          <Text
            style={[
              styles.remaining,
              { color: remaining >= 0 ? colors.greenDark : colors.orange },
            ]}
          >
            {remaining >= 0 ? remaining : Math.abs(remaining)}
          </Text>
          <Text style={styles.remainingLabel}>
            {remaining >= 0 ? 'remaining' : 'over'}
          </Text>
        </View>
      </View>

      <View style={styles.barWrap}>
        <ProgressBar value={totals.calories} goal={goal.calorieGoal} />
      </View>

      <View style={styles.macros}>
        <Macro label="Protein" value={totals.protein} />
        <Macro label="Carbs" value={totals.carbs} />
        <Macro label="Fat" value={totals.fat} />
      </View>

      {editing ? (
        <View style={styles.editRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            keyboardType="number-pad"
            accessibilityLabel="Calorie goal"
            placeholder="Goal"
            placeholderTextColor={colors.textFaint}
          />
          <Button label="Save" onPress={save} loading={saving} />
          <Button label="Cancel" variant="ghost" onPress={() => setEditing(false)} />
        </View>
      ) : (
        <View style={styles.editTrigger}>
          <Button label="Edit goal" variant="ghost" onPress={() => setEditing(true)} />
        </View>
      )}
    </Card>
  );
}

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.macro}>
      <Text style={styles.macroValue}>{value}g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  calories: { fontSize: 40, fontWeight: '800', color: colors.text, lineHeight: 44 },
  caloriesLabel: { fontSize: font.small, color: colors.textMuted },
  remainingBox: { alignItems: 'flex-end' },
  remaining: { fontSize: font.h2, fontWeight: '800' },
  remainingLabel: { fontSize: font.tiny, color: colors.textMuted, textTransform: 'uppercase' },
  barWrap: { marginVertical: spacing.md },
  macros: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.xs },
  macro: { alignItems: 'center' },
  macroValue: { fontSize: font.h3, fontWeight: '700', color: colors.text },
  macroLabel: { fontSize: font.tiny, color: colors.textMuted, textTransform: 'uppercase' },
  editTrigger: { alignItems: 'flex-start', marginTop: spacing.sm },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: font.body,
    color: colors.text,
  },
});
