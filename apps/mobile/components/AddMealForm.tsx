// Manual add form: name, calories, type, and optional macros.
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { CreateMeal, MealType } from '@k21/validation';
import { colors, font, radius, spacing } from '@/lib/theme';
import { Button, Card, ErrorText, SectionTitle } from './ui';
import { MealTypePicker } from './MealTypePicker';

export function AddMealForm({
  date,
  onAdd,
}: {
  date: string;
  onAdd: (meal: CreateMeal) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [type, setType] = useState<MealType>('breakfast');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function num(v: string): number {
    const n = parseInt(v, 10);
    return Number.isNaN(n) || n < 0 ? 0 : n;
  }

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError('Please enter a food name.');
      return;
    }
    const cals = num(calories);
    if (cals <= 0) {
      setError('Please enter the calories.');
      return;
    }
    setSaving(true);
    try {
      await onAdd({
        name: name.trim(),
        calories: cals,
        type,
        date,
        protein: num(protein),
        carbs: num(carbs),
        fat: num(fat),
        health: 0,
        source: 'manual',
      });
      setName('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add meal.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <SectionTitle>Add manually</SectionTitle>

      <Field label="Food name">
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Greek yogurt"
          placeholderTextColor={colors.textFaint}
          accessibilityLabel="Food name"
        />
      </Field>

      <Field label="Calories (kcal)">
        <TextInput
          style={styles.input}
          value={calories}
          onChangeText={setCalories}
          placeholder="0"
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
          accessibilityLabel="Calories"
        />
      </Field>

      <Field label="Meal type">
        <MealTypePicker value={type} onChange={setType} />
      </Field>

      <Field label="Macros (optional, grams)">
        <View style={styles.macroRow}>
          <MacroInput label="Protein" value={protein} onChange={setProtein} />
          <MacroInput label="Carbs" value={carbs} onChange={setCarbs} />
          <MacroInput label="Fat" value={fat} onChange={setFat} />
        </View>
      </Field>

      <ErrorText message={error} />
      <View style={styles.submit}>
        <Button label="Add meal" onPress={submit} loading={saving} />
      </View>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function MacroInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.macroInputWrap}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={colors.textFaint}
        keyboardType="number-pad"
        accessibilityLabel={`${label} grams`}
      />
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  label: { fontSize: font.small, color: colors.textMuted, marginBottom: spacing.xs, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: font.body,
    color: colors.text,
    backgroundColor: colors.white,
  },
  macroRow: { flexDirection: 'row', gap: spacing.sm },
  macroInputWrap: { flex: 1 },
  macroLabel: { fontSize: font.tiny, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
  submit: { marginTop: spacing.sm },
});
