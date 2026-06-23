// Snap tab: take/select a photo, downscale to ~1280px JPEG, POST to
// /api/analyze-food, show the structured result, and add it as an AI meal.
import React, { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import type { AnalyzeFoodResponse, CreateMeal, MealType } from '@k21/validation';
import { analyzeFood, ApiError, createMeal } from '@/lib/api';
import { useSelectedDate } from '@/lib/useToday';
import { relativeDate } from '@/lib/date';
import { colors, font, radius, spacing } from '@/lib/theme';
import { Button, Card, ErrorText, Loading, SectionTitle } from '@/components/ui';
import { HealthDots } from '@/components/HealthDots';
import { MealTypePicker } from '@/components/MealTypePicker';

const MAX_DIMENSION = 1280;

export default function SnapScreen() {
  const [date] = useSelectedDate();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzeFoodResponse | null>(null);
  const [type, setType] = useState<MealType>('lunch');
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function pick(source: 'camera' | 'library') {
    setError(null);
    setResult(null);

    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(
        source === 'camera'
          ? 'Camera permission is required to snap a meal.'
          : 'Photo library permission is required to choose a photo.',
      );
      return;
    }

    const picker = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const picked = await picker({
      mediaTypes: ['images'],
      quality: 1,
      base64: false,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    await analyze(picked.assets[0].uri);
  }

  async function analyze(uri: string) {
    setAnalyzing(true);
    setError(null);
    try {
      // Downscale + re-encode to JPEG, returning base64.
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: MAX_DIMENSION } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );
      setImageUri(manipulated.uri);
      if (!manipulated.base64) {
        setError('Could not read the image data. Please try another photo.');
        return;
      }
      const analysis = await analyzeFood(manipulated.base64, 'image/jpeg');
      setResult(analysis);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else setError('Could not analyze the image. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function addAsMeal() {
    if (!result) return;
    setAdding(true);
    setError(null);
    try {
      const meal: CreateMeal = {
        name: result.food_name,
        calories: result.estimated_calories,
        type,
        date,
        protein: result.protein_g,
        carbs: result.carbs_g,
        fat: result.fat_g,
        health: result.healthiness_rating,
        source: 'ai',
      };
      await createMeal(meal);
      Alert.alert('Added', `"${result.food_name}" was added to ${relativeDate(date)}.`);
      setResult(null);
      setImageUri(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add meal.');
    } finally {
      setAdding(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.context}>
          Adding to <Text style={styles.contextStrong}>{relativeDate(date)}</Text>
        </Text>

        <Card>
          <SectionTitle>Snap or choose a meal photo</SectionTitle>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.preview}
              accessibilityLabel="Selected meal photo"
            />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderIcon}>◉</Text>
              <Text style={styles.placeholderText}>No photo yet</Text>
            </View>
          )}
          <View style={styles.actions}>
            <Button label="Take photo" onPress={() => void pick('camera')} disabled={analyzing} />
            <Button
              label="Choose from library"
              variant="secondary"
              onPress={() => void pick('library')}
              disabled={analyzing}
            />
          </View>
        </Card>

        <ErrorText message={error} />

        {analyzing ? <Loading label="Analyzing your meal…" /> : null}

        {result ? (
          <Card>
            <View style={styles.resultHead}>
              <Text style={styles.foodName}>{result.food_name}</Text>
              <View style={[styles.confidence, confidenceStyle(result.confidence)]}>
                <Text style={styles.confidenceText}>{result.confidence} confidence</Text>
              </View>
            </View>

            <Text style={styles.bigCals}>{result.estimated_calories} kcal</Text>

            <View style={styles.macros}>
              <Macro label="Protein" value={result.protein_g} />
              <Macro label="Carbs" value={result.carbs_g} />
              <Macro label="Fat" value={result.fat_g} />
            </View>

            <View style={styles.healthRow}>
              <HealthDots health={result.healthiness_rating} size={12} />
              <Text style={styles.healthLabel}>Healthiness {result.healthiness_rating}/5</Text>
            </View>

            {result.portion_recommendation ? (
              <Text style={styles.tip}>💡 {result.portion_recommendation}</Text>
            ) : null}
            {result.notes ? <Text style={styles.notes}>{result.notes}</Text> : null}

            <Text style={styles.provenance}>
              via {result.provider} · {result.model}
            </Text>

            <View style={styles.typeWrap}>
              <Text style={styles.label}>Add as</Text>
              <MealTypePicker value={type} onChange={setType} />
            </View>

            <View style={styles.addWrap}>
              <Button label="Add to today" onPress={() => void addAsMeal()} loading={adding} />
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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

function confidenceStyle(c: AnalyzeFoodResponse['confidence']) {
  if (c === 'high') return { backgroundColor: colors.greenSoft };
  if (c === 'medium') return { backgroundColor: colors.orangeSoft };
  return { backgroundColor: colors.dangerSoft };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  context: { fontSize: font.small, color: colors.textMuted },
  contextStrong: { color: colors.greenDark, fontWeight: '700' },
  preview: { width: '100%', height: 220, borderRadius: radius.md, marginVertical: spacing.md },
  placeholder: {
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
    gap: spacing.xs,
  },
  placeholderIcon: { fontSize: 40, color: colors.textFaint },
  placeholderText: { color: colors.textMuted, fontSize: font.small },
  actions: { gap: spacing.sm },
  resultHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  foodName: { fontSize: font.h2, fontWeight: '800', color: colors.text, flex: 1 },
  confidence: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  confidenceText: { fontSize: font.tiny, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  bigCals: { fontSize: 36, fontWeight: '900', color: colors.greenDark, marginVertical: spacing.sm },
  macros: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: spacing.sm },
  macro: { alignItems: 'center' },
  macroValue: { fontSize: font.h3, fontWeight: '700', color: colors.text },
  macroLabel: { fontSize: font.tiny, color: colors.textMuted, textTransform: 'uppercase' },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.sm },
  healthLabel: { fontSize: font.small, color: colors.textMuted },
  tip: { fontSize: font.small, color: colors.text, marginTop: spacing.sm },
  notes: { fontSize: font.small, color: colors.textMuted, marginTop: spacing.xs },
  provenance: { fontSize: font.tiny, color: colors.textFaint, marginTop: spacing.sm, fontStyle: 'italic' },
  typeWrap: { marginTop: spacing.md, gap: spacing.xs },
  label: { fontSize: font.small, color: colors.textMuted, fontWeight: '600' },
  addWrap: { marginTop: spacing.md },
});
