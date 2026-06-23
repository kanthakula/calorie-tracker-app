// Date selector for the Today screen: step back/forward a day, with a native
// date picker for jumping. Cannot go past today.
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { colors, font, radius, spacing } from '@/lib/theme';
import { addDays, fromIso, relativeDate, todayIso, toIso } from '@/lib/date';

export function DateSelector({
  date,
  onChange,
}: {
  date: string;
  onChange: (iso: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const isToday = date === todayIso();

  function handlePicked(event: DateTimePickerEvent, picked?: Date) {
    setShowPicker(false);
    if (event.type === 'set' && picked) {
      const iso = toIso(picked);
      onChange(iso > todayIso() ? todayIso() : iso);
    }
  }

  return (
    <View style={styles.row}>
      <Arrow label="◀" accessibilityLabel="Previous day" onPress={() => onChange(addDays(date, -1))} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Selected date ${relativeDate(date)}. Tap to change.`}
        onPress={() => setShowPicker(true)}
        style={styles.center}
      >
        <Text style={styles.label}>{relativeDate(date)}</Text>
      </Pressable>

      <Arrow
        label="▶"
        accessibilityLabel="Next day"
        disabled={isToday}
        onPress={() => !isToday && onChange(addDays(date, 1))}
      />

      {showPicker ? (
        <DateTimePicker
          value={fromIso(date)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          maximumDate={fromIso(todayIso())}
          onChange={handlePicked}
        />
      ) : null}
    </View>
  );
}

function Arrow({
  label,
  accessibilityLabel,
  onPress,
  disabled = false,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.arrow,
        pressed && !disabled && styles.arrowPressed,
        disabled && styles.arrowDisabled,
      ]}
    >
      <Text style={styles.arrowText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  center: { flex: 1, alignItems: 'center' },
  label: { fontSize: font.h3, fontWeight: '700', color: colors.text },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
  },
  arrowPressed: { opacity: 0.7 },
  arrowDisabled: { opacity: 0.3 },
  arrowText: { fontSize: font.body, color: colors.greenDark, fontWeight: '800' },
});
