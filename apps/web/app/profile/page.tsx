'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  computeTargets,
  DIET_PATTERN_LABELS,
  DietPatternSchema,
  type ActivityLevel,
  type DietPattern,
  type Profile,
  type Sex,
  type Targets,
  type UpdateProfile,
  type WeightGoal,
} from '@k21/validation';
import type { AdaptiveTDEE } from '@k21/validation';
import Link from 'next/link';
import { RequireAuth } from '@/components/RequireAuth';
import { Header } from '@/components/Header';
import { useAuth } from '@/lib/auth';
import { WeightCard } from '@/components/WeightCard';
import { TargetSourceBadge } from '@/components/TargetSourceBadge';
import { useToast } from '@/components/useToast';
import { getProfile, updateProfile, ApiError } from '@/lib/api';
import type { TargetSource } from '@/lib/types';
import { todayIso } from '@/lib/date';
import styles from './profile.module.css';

const ACTIVITY_OPTIONS: Array<{ value: ActivityLevel; label: string }> = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Lightly active' },
  { value: 'moderate', label: 'Moderately active' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very active' },
];

const SEX_OPTIONS: Array<{ value: Sex; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other / prefer not to say' },
];

const GOAL_OPTIONS: Array<{ value: WeightGoal; label: string }> = [
  { value: 'lose', label: 'Lose' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Gain' },
];

/** One-line description of how each pattern shifts the macro split. */
const DIET_BLURBS: Record<DietPattern, string> = {
  balanced: 'Even split of protein, carbs, and fat.',
  high_protein: 'More protein to support muscle and satiety.',
  low_carb: 'Fewer carbs, more protein and fat.',
  keto: 'Very low carb, high fat.',
  mediterranean: 'Whole foods, healthy fats, moderate carbs.',
};

const DIET_OPTIONS: Array<{ value: DietPattern; blurb: string }> =
  DietPatternSchema.options.map((value) => ({ value, blurb: DIET_BLURBS[value] }));

/** Editable form state — strings for number inputs so the fields can be cleared. */
interface FormState {
  displayName: string;
  age: string;
  sex: '' | Sex;
  heightCm: string;
  currentWeightKg: string;
  targetWeightKg: string;
  activityLevel: ActivityLevel;
  goal: WeightGoal;
  dietPattern: DietPattern;
  autoTargets: boolean;
  calorieTarget: string;
  proteinTarget: string;
  carbTarget: string;
  fatTarget: string;
  waterTargetMl: string;
}

function numOrEmpty(v: number | null | undefined): string {
  return v == null ? '' : String(v);
}

function profileToForm(p: Profile): FormState {
  return {
    displayName: p.displayName ?? '',
    age: numOrEmpty(p.age),
    sex: p.sex ?? '',
    heightCm: numOrEmpty(p.heightCm),
    currentWeightKg: numOrEmpty(p.currentWeightKg),
    targetWeightKg: numOrEmpty(p.targetWeightKg),
    activityLevel: p.activityLevel,
    goal: p.goal,
    dietPattern: p.dietPattern,
    autoTargets: p.autoTargets,
    calorieTarget: numOrEmpty(p.calorieTarget),
    proteinTarget: numOrEmpty(p.proteinTarget),
    carbTarget: numOrEmpty(p.carbTarget),
    fatTarget: numOrEmpty(p.fatTarget),
    waterTargetMl: numOrEmpty(p.waterTargetMl),
  };
}

/** Parse a numeric string to a number, or null when blank/invalid. */
function toNum(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <Header />
      <ProfileEditor />
    </RequireAuth>
  );
}

function ProfileEditor() {
  const { signOut } = useAuth();
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [adaptiveTdee, setAdaptiveTdee] = useState<AdaptiveTDEE | null>(null);
  const [targetSource, setTargetSource] = useState<TargetSource | null>(null);
  const { show, node: toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getProfile();
        if (cancelled) return;
        setForm(profileToForm(res.profile));
        setAdaptiveTdee(res.adaptiveTdee ?? null);
        setTargetSource(res.targetSource ?? null);
        // Treat a profile with no core stats as "new".
        setIsNew(
          res.profile.age == null &&
            res.profile.heightCm == null &&
            res.profile.currentWeightKg == null,
        );
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Could not load your profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Live suggested targets from the current stats (before saving).
  const suggested = useMemo<Targets | null>(() => {
    if (!form) return null;
    return computeTargets({
      age: toNum(form.age),
      sex: form.sex === '' ? null : form.sex,
      heightCm: toNum(form.heightCm),
      currentWeightKg: toNum(form.currentWeightKg),
      activityLevel: form.activityLevel,
      goal: form.goal,
      dietPattern: form.dietPattern,
    });
  }, [form]);

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    [],
  );

  // Editing a target manually implies the user is no longer on auto.
  const setTargetField = useCallback(
    (key: 'calorieTarget' | 'proteinTarget' | 'carbTarget' | 'fatTarget' | 'waterTargetMl', value: string) => {
      setForm((prev) => (prev ? { ...prev, [key]: value, autoTargets: false } : prev));
    },
    [],
  );

  // Diet pattern saves immediately so the effective/suggested targets shift
  // (protein/carb/fat ratios change per pattern) without a full form submit.
  async function changeDiet(next: DietPattern) {
    setField('dietPattern', next);
    try {
      const res = await updateProfile({ dietPattern: next });
      setForm(profileToForm(res.profile));
      setAdaptiveTdee(res.adaptiveTdee ?? null);
      setTargetSource(res.targetSource ?? null);
      show(`Diet set to ${DIET_PATTERN_LABELS[next]}`);
    } catch (err) {
      show(err instanceof ApiError ? err.message : 'Could not update diet pattern');
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);

    const patch: UpdateProfile = {
      displayName: form.displayName.trim() === '' ? null : form.displayName.trim(),
      age: toNum(form.age),
      sex: form.sex === '' ? null : form.sex,
      heightCm: toNum(form.heightCm),
      currentWeightKg: toNum(form.currentWeightKg),
      targetWeightKg: toNum(form.targetWeightKg),
      activityLevel: form.activityLevel,
      goal: form.goal,
      dietPattern: form.dietPattern,
      autoTargets: form.autoTargets,
    };

    // Only send manual targets when auto is off; otherwise let the server derive them.
    if (!form.autoTargets) {
      patch.calorieTarget = toNum(form.calorieTarget);
      patch.proteinTarget = toNum(form.proteinTarget);
      patch.carbTarget = toNum(form.carbTarget);
      patch.fatTarget = toNum(form.fatTarget);
      patch.waterTargetMl = toNum(form.waterTargetMl);
    }

    try {
      const res = await updateProfile(patch);
      setForm(profileToForm(res.profile));
      setAdaptiveTdee(res.adaptiveTdee ?? null);
      setTargetSource(res.targetSource ?? null);
      setIsNew(false);
      show('Profile saved');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not save your profile.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="app-main" id="main">
        <p className="subtle">Loading your profile…</p>
      </main>
    );
  }

  if (!form) {
    return (
      <main className="app-main" id="main">
        <div className="card" role="alert">
          <p className="error-text">{error ?? 'Could not load your profile.'}</p>
        </div>
      </main>
    );
  }

  // When auto is on, the editable target inputs are prefilled from the suggestion.
  const targetDefaults = suggested;

  return (
    <main className="app-main" id="main">
      <h1 className={styles.title}>Your profile</h1>

      <div className={styles.account}>
        <Link href="/admin" className="btn btn-ghost">
          ⚙️ Settings
        </Link>
        <button type="button" className="btn btn-ghost" onClick={signOut}>
          Sign out
        </button>
      </div>

      {isNew && (
        <div className={`card ${styles.welcome}`}>
          <p className="muted">
            Welcome! Add your stats below and we&rsquo;ll suggest personalized daily
            targets for calories, protein, carbs, fat, and water.
          </p>
        </div>
      )}

      {error && (
        <div className="card" role="alert">
          <p className="error-text">{error}</p>
        </div>
      )}

      <form onSubmit={submit} className={styles.form}>
        <section className="card" aria-labelledby="stats-heading">
          <h2 id="stats-heading">Your stats</h2>

          <div className="field">
            <label htmlFor="displayName">Display name</label>
            <input
              id="displayName"
              className="input"
              type="text"
              maxLength={80}
              value={form.displayName}
              onChange={(e) => setField('displayName', e.target.value)}
              placeholder="What should we call you?"
            />
          </div>

          <div className={styles.grid}>
            <div className="field">
              <label htmlFor="age">Age</label>
              <input
                id="age"
                className="input"
                type="number"
                inputMode="numeric"
                min={1}
                max={120}
                value={form.age}
                onChange={(e) => setField('age', e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="sex">Sex</label>
              <select
                id="sex"
                className="select"
                value={form.sex}
                onChange={(e) => setField('sex', e.target.value as '' | Sex)}
              >
                <option value="">Prefer not to say</option>
                {SEX_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="heightCm">Height (cm)</label>
              <input
                id="heightCm"
                className="input"
                type="number"
                inputMode="numeric"
                min={50}
                max={260}
                value={form.heightCm}
                onChange={(e) => setField('heightCm', e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="currentWeightKg">Current weight (kg)</label>
              <input
                id="currentWeightKg"
                className="input"
                type="number"
                inputMode="decimal"
                min={20}
                max={400}
                step="0.1"
                value={form.currentWeightKg}
                onChange={(e) => setField('currentWeightKg', e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="targetWeightKg">Target weight (kg)</label>
              <input
                id="targetWeightKg"
                className="input"
                type="number"
                inputMode="decimal"
                min={20}
                max={400}
                step="0.1"
                value={form.targetWeightKg}
                onChange={(e) => setField('targetWeightKg', e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="activityLevel">Activity level</label>
              <select
                id="activityLevel"
                className="select"
                value={form.activityLevel}
                onChange={(e) =>
                  setField('activityLevel', e.target.value as ActivityLevel)
                }
              >
                {ACTIVITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="goal">Goal</label>
              <select
                id="goal"
                className="select"
                value={form.goal}
                onChange={(e) => setField('goal', e.target.value as WeightGoal)}
              >
                {GOAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby="diet-heading">
          <h2 id="diet-heading">
            <span aria-hidden="true">🥑</span> Diet pattern
          </h2>
          <p className="subtle" style={{ marginTop: '-0.4rem' }}>
            Shapes your suggested macro split (protein / carbs / fat).
          </p>
          <div
            className={styles.dietGrid}
            role="radiogroup"
            aria-label="Diet pattern"
          >
            {DIET_OPTIONS.map((o) => {
              const active = form.dietPattern === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`${styles.dietBtn} ${active ? styles.dietBtnActive : ''}`}
                  onClick={() => void changeDiet(o.value)}
                >
                  <span className={styles.dietName}>
                    {active && (
                      <span aria-hidden="true" className={styles.dietCheck}>
                        ✓{' '}
                      </span>
                    )}
                    {DIET_PATTERN_LABELS[o.value]}
                  </span>
                  <span className={styles.dietBlurb}>{o.blurb}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="card" aria-labelledby="targets-heading">
          <div className={styles.targetsHead}>
            <h2 id="targets-heading">Daily targets</h2>
            {targetSource && <TargetSourceBadge source={targetSource} />}
          </div>

          <AdaptivePanel source={targetSource} adaptive={adaptiveTdee} />

          {suggested ? (
            <div className={styles.suggestion}>
              <span className={styles.suggestionLabel}>Suggested</span>
              <div className={styles.suggestionGrid}>
                <SuggestionStat label="Calories" value={suggested.calorieTarget} unit="kcal" />
                <SuggestionStat label="Protein" value={suggested.proteinTarget} unit="g" />
                <SuggestionStat label="Carbs" value={suggested.carbTarget} unit="g" />
                <SuggestionStat label="Fat" value={suggested.fatTarget} unit="g" />
                <SuggestionStat label="Water" value={suggested.waterTargetMl} unit="ml" />
              </div>
            </div>
          ) : (
            <p className="subtle">
              Add your age, height, and current weight to see suggested targets.
            </p>
          )}

          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={form.autoTargets}
              onChange={(e) => setField('autoTargets', e.target.checked)}
            />
            <span>Use suggested targets automatically</span>
          </label>

          {!form.autoTargets && (
            <div className={styles.grid}>
              <TargetInput
                id="calorieTarget"
                label="Calories (kcal)"
                max={20000}
                value={form.calorieTarget}
                placeholder={numOrEmpty(targetDefaults?.calorieTarget)}
                onChange={(v) => setTargetField('calorieTarget', v)}
              />
              <TargetInput
                id="proteinTarget"
                label="Protein (g)"
                max={1000}
                value={form.proteinTarget}
                placeholder={numOrEmpty(targetDefaults?.proteinTarget)}
                onChange={(v) => setTargetField('proteinTarget', v)}
              />
              <TargetInput
                id="carbTarget"
                label="Carbs (g)"
                max={2000}
                value={form.carbTarget}
                placeholder={numOrEmpty(targetDefaults?.carbTarget)}
                onChange={(v) => setTargetField('carbTarget', v)}
              />
              <TargetInput
                id="fatTarget"
                label="Fat (g)"
                max={1000}
                value={form.fatTarget}
                placeholder={numOrEmpty(targetDefaults?.fatTarget)}
                onChange={(v) => setTargetField('fatTarget', v)}
              />
              <TargetInput
                id="waterTargetMl"
                label="Water (ml)"
                max={20000}
                value={form.waterTargetMl}
                placeholder={numOrEmpty(targetDefaults?.waterTargetMl)}
                onChange={(v) => setTargetField('waterTargetMl', v)}
              />
            </div>
          )}
        </section>

        <div className={styles.actions}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>

      <WeightCard date={todayIso()} />

      {toast}
    </main>
  );
}

/**
 * Explains where targets come from. When adaptive, shows the measured TDEE,
 * confidence, days of data, and the weekly weight change. When still estimated,
 * nudges the user toward ~2 weeks of logging + a few weigh-ins.
 */
function AdaptivePanel({
  source,
  adaptive,
}: {
  source: TargetSource | null;
  adaptive: AdaptiveTDEE | null;
}) {
  if (adaptive) {
    const w = adaptive.weightChangeKgPerWeek;
    return (
      <div className={`${styles.adaptive} ${styles.adaptiveOn}`}>
        <p className={styles.adaptiveTitle}>
          <span aria-hidden="true">📈</span> Measured TDEE{' '}
          <span className={`num ${styles.adaptiveTdee}`}>
            {adaptive.tdee.toLocaleString()}
          </span>{' '}
          kcal
        </p>
        <p className="subtle">
          {adaptive.confidence} confidence, from{' '}
          <span className="num">{adaptive.basedOnDays}</span> days ·{' '}
          weight {w > 0 ? '+' : ''}
          <span className="num">{w.toFixed(2)}</span> kg/week
        </p>
        <p className="subtle">
          Your targets now adapt to your real intake and weight trend.
        </p>
      </div>
    );
  }

  if (source === 'manual') {
    return (
      <div className={styles.adaptive}>
        <p className="subtle">
          You&rsquo;re using manual targets, so they stay in your control. Weigh
          in regularly and your measured TDEE will appear here for reference.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.adaptive}>
      <p className="subtle">
        Targets are <strong>estimated</strong> from your stats right now. Log meals
        for ~2+ weeks and add a few weigh-ins to unlock <strong>adaptive</strong>{' '}
        targets measured from your real data. 🌱
      </p>
    </div>
  );
}

function SuggestionStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>
        {value.toLocaleString()}
        <span className={styles.statUnit}>{unit}</span>
      </span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function TargetInput({
  id,
  label,
  max,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  max: number;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
