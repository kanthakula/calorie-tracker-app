// Calories-vs-goal progress bar. Fills green up to the goal, turns orange when
// the user goes over.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/lib/theme';

export function ProgressBar({ value, goal }: { value: number; goal: number }) {
  const ratio = goal > 0 ? value / goal : 0;
  const pct = Math.max(0, Math.min(1, ratio));
  const over = ratio > 1;
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: goal, now: value }}
    >
      <View
        style={[
          styles.fill,
          { width: `${pct * 100}%`, backgroundColor: over ? colors.orange : colors.green },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.greenSoft,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
});
