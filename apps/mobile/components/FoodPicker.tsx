// Food-library picker: category filter + search; tap a food to expand a quantity
// stepper and add it as a meal. health is derived from the food's category.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CreateMeal, FoodItem, MealType } from '@k21/validation';
import { colors, font, radius, spacing } from '@/lib/theme';
import { Button, Card, Chip, ErrorText, SectionTitle } from './ui';
import { MealTypePicker } from './MealTypePicker';
import { getFoodCategories, getFoods } from '@/lib/api';
import { healthForCategory } from '@/lib/health';

export function FoodPicker({
  date,
  onAdd,
}: {
  date: string;
  onAdd: (meal: CreateMeal) => Promise<void>;
}) {
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<MealType>('lunch');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getFoodCategories()
      .then((c) => {
        if (active) setCategories(c);
      })
      .catch(() => {
        /* categories are optional; search still works */
      });
    return () => {
      active = false;
    };
  }, []);

  // Debounced fetch on category/search change.
  useEffect(() => {
    let active = true;
    const handle = setTimeout(() => {
      setLoading(true);
      setError(null);
      getFoods({
        category: category ?? undefined,
        search: search.trim() || undefined,
      })
        .then((f) => {
          if (active) setFoods(f);
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : 'Could not load foods.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [category, search]);

  return (
    <Card>
      <SectionTitle>From the food library</SectionTitle>

      <Text style={styles.label}>Add as</Text>
      <View style={styles.typeRow}>
        <MealTypePicker value={type} onChange={setType} />
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search foods…"
        placeholderTextColor={colors.textFaint}
        accessibilityLabel="Search foods"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catRow}
      >
        <Chip label="All" selected={category === null} onPress={() => setCategory(null)} />
        {categories.map((c) => (
          <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </ScrollView>

      <ErrorText message={error} />

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginVertical: spacing.lg }} />
      ) : foods.length === 0 ? (
        <Text style={styles.empty}>No foods match your filters.</Text>
      ) : (
        <View style={styles.list}>
          {foods.map((food) => (
            <FoodCard
              key={food.id}
              food={food}
              date={date}
              type={type}
              expanded={expandedId === food.id}
              onToggle={() => setExpandedId(expandedId === food.id ? null : food.id)}
              onAdd={onAdd}
            />
          ))}
        </View>
      )}
    </Card>
  );
}

function FoodCard({
  food,
  date,
  type,
  expanded,
  onToggle,
  onAdd,
}: {
  food: FoodItem;
  date: string;
  type: MealType;
  expanded: boolean;
  onToggle: () => void;
  onAdd: (meal: CreateMeal) => Promise<void>;
}) {
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);

  async function add() {
    setSaving(true);
    try {
      await onAdd({
        name: qty > 1 ? `${food.name} (x${qty})` : food.name,
        calories: food.calories * qty,
        type,
        date,
        protein: food.protein * qty,
        carbs: food.carbs * qty,
        fat: food.fat * qty,
        health: healthForCategory(food.category),
        source: 'library',
      });
      setQty(1);
      onToggle();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.foodCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${food.name}, ${food.calories} calories per ${food.serving}`}
        onPress={onToggle}
        style={styles.foodHead}
      >
        <View style={styles.foodInfo}>
          <Text style={styles.foodName}>{food.name}</Text>
          <Text style={styles.foodMeta}>
            {food.category} · {food.serving}
          </Text>
        </View>
        <Text style={styles.foodCals}>{food.calories} kcal</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.expand}>
          <View style={styles.stepper}>
            <StepBtn label="−" onPress={() => setQty((q) => Math.max(1, q - 1))} />
            <Text style={styles.qty} accessibilityLabel={`Quantity ${qty}`}>
              {qty}
            </Text>
            <StepBtn label="+" onPress={() => setQty((q) => Math.min(20, q + 1))} />
          </View>
          <Button
            label={`Add ${food.calories * qty} kcal`}
            onPress={add}
            loading={saving}
          />
        </View>
      ) : null}
    </View>
  );
}

function StepBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Increase quantity' : 'Decrease quantity'}
      onPress={onPress}
      style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed]}
    >
      <Text style={styles.stepBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: font.small, color: colors.textMuted, marginBottom: spacing.xs, fontWeight: '600' },
  typeRow: { marginBottom: spacing.md },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: font.body,
    color: colors.text,
    backgroundColor: colors.white,
    marginBottom: spacing.md,
  },
  catRow: { gap: spacing.sm, paddingBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
  list: { gap: spacing.sm },
  foodCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  foodHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  foodInfo: { flex: 1, paddingRight: spacing.sm },
  foodName: { fontSize: font.body, fontWeight: '700', color: colors.text },
  foodMeta: { fontSize: font.tiny, color: colors.textMuted },
  foodCals: { fontSize: font.body, fontWeight: '700', color: colors.greenDark },
  expand: {
    padding: spacing.md,
    paddingTop: 0,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingTop: spacing.md },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPressed: { opacity: 0.7 },
  stepBtnText: { fontSize: font.h2, fontWeight: '800', color: colors.greenDark },
  qty: { fontSize: font.h2, fontWeight: '800', color: colors.text, minWidth: 32, textAlign: 'center' },
});
