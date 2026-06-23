// Segmented control for choosing a meal type.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { MealType } from '@k21/validation';
import { Chip } from './ui';
import { spacing } from '@/lib/theme';

const TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export function MealTypePicker({
  value,
  onChange,
}: {
  value: MealType;
  onChange: (t: MealType) => void;
}) {
  return (
    <View style={styles.row}>
      {TYPES.map((t) => (
        <Chip
          key={t}
          label={t.charAt(0).toUpperCase() + t.slice(1)}
          selected={value === t}
          onPress={() => onChange(t)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
