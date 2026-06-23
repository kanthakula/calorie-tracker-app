// A simple empty-state block.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '@/lib/theme';

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs },
  title: { fontSize: font.body, fontWeight: '700', color: colors.text },
  hint: { fontSize: font.small, color: colors.textMuted, textAlign: 'center' },
});
