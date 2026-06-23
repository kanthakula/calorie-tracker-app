// Insight card: headline + suggestion + average health for the day.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DailyInsight } from '@/lib/types';
import { colors, font, radius, spacing } from '@/lib/theme';
import { HealthDots } from './HealthDots';
import { healthLabel } from '@/lib/health';

export function InsightCard({ insight }: { insight: DailyInsight }) {
  return (
    <View style={styles.card}>
      <Text style={styles.headline}>{insight.headline}</Text>
      <Text style={styles.suggestion}>{insight.suggestion}</Text>
      <View style={styles.healthRow}>
        <HealthDots health={insight.avgHealth} size={10} />
        <Text style={styles.healthLabel}>
          Avg health: {healthLabel(insight.avgHealth)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.greenSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.green,
  },
  headline: { fontSize: font.h3, fontWeight: '800', color: colors.greenDark },
  suggestion: { fontSize: font.body, color: colors.text, marginTop: spacing.xs },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  healthLabel: { fontSize: font.small, color: colors.textMuted },
});
