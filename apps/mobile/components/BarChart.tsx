// A simple daily-calorie bar chart drawn entirely with Views (no chart library).
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '@/lib/theme';
import { shortDate } from '@/lib/date';

export interface BarDatum {
  date: string;
  calories: number;
}

export function BarChart({ data, goal }: { data: BarDatum[]; goal?: number }) {
  const max = Math.max(1, goal ?? 0, ...data.map((d) => d.calories));
  // Cap how many x-labels we render so 30/All ranges stay legible.
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <View style={styles.wrap}>
      <View style={styles.plot}>
        {data.map((d, i) => {
          const h = Math.max(2, (d.calories / max) * 140);
          const over = goal != null && goal > 0 && d.calories > goal;
          return (
            <View key={d.date} style={styles.col}>
              <View style={styles.barArea}>
                <View
                  accessibilityLabel={`${shortDate(d.date)}: ${d.calories} calories`}
                  style={[
                    styles.bar,
                    { height: h, backgroundColor: over ? colors.orange : colors.green },
                  ]}
                />
              </View>
              <Text style={styles.xLabel} numberOfLines={1}>
                {i % labelEvery === 0 ? shortDate(d.date) : ''}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  plot: { flexDirection: 'row', alignItems: 'flex-end', height: 175 },
  col: { flex: 1, alignItems: 'center' },
  barArea: { height: 145, justifyContent: 'flex-end' },
  bar: { width: '70%', minWidth: 4, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  xLabel: { fontSize: font.tiny, color: colors.textMuted, marginTop: 4, height: 14 },
});
