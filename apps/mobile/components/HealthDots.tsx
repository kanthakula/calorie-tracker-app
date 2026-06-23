// A compact 1-5 health rating shown as filled dots, coloured by the health scale.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, healthColor } from '@/lib/theme';
import { healthLabel } from '@/lib/health';

export function HealthDots({ health, size = 8 }: { health: number; size?: number }) {
  const rounded = Math.round(health);
  const accent = healthColor(health);
  return (
    <View
      style={styles.row}
      accessibilityRole="image"
      accessibilityLabel={`Health rating: ${healthLabel(health)}`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { width: size, height: size, borderRadius: size / 2 },
            { backgroundColor: i <= rounded && rounded > 0 ? accent : colors.border },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  dot: {},
});
