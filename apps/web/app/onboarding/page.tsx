'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  computeTargets,
  DIET_PATTERN_LABELS,
  DietPatternSchema,
  type ActivityLevel,
  type DietPattern,
  type Sex,
  type UpdateProfile,
  type WeightGoal,
} from '@k21/validation';
import { RequireAuth } from '@/components/RequireAuth';
import { updateProfile, ApiError } from '@/lib/api';
import { ONBOARDED_FLAG } from '@/lib/onboarding';
import styles from './onboarding.module.css';

const GOALS: Array<{ value: WeightGoal; icon: string; label: string; sub: string }> = [
  { value: 'lose', icon: '📉', label: 'Lose weight', sub: 'Calorie deficit (−500/day)' },
  { value: 'maintain', icon: '⚖️', label: 'Maintain', sub: 'Hold your current weight' },
  { value: 'gain', icon: '📈', label: 'Build / gain', sub: 'Calorie surplus (+300/day)' },
];

const SEXES: Array<{ value: Sex; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const ACTIVITIES: Array<{ value: ActivityLevel; label: string; sub: string }> = [
  { value: 'sedentary', label: 'Sedentary', sub: 'Little or no exercise' },
  { value: 'light', label: 'Lightly active', sub: 'Light exercise 1–3 days/week' },
  { value: 'moderate', label: 'Moderately active', sub: 'Moderate exercise 3–5 days/week' },
  { value: 'active', label: 'Active', sub: 'Hard exercise 6–7 days/week' },
  { value: 'very_active', label: 'Very active', sub: 'Physical job or 2× training' },
];

const DIET_BLURBS: Record<DietPattern, string> = {
  balanced: 'Even split of protein, carbs, and fat.',
  high_protein: 'More protein for muscle and satiety.',
  low_carb: 'Fewer carbs, more protein and fat.',
  keto: 'Very low carb, high fat.',
  mediterranean: 'Whole foods, healthy fats, moderate carbs.',
};

const STEPS = ['Goal', 'About you', 'Activity', 'Diet', 'Your targets'];

interface WizardData {
  goal: WeightGoal;
  sex: '' | Sex;
  age: string;
  heightCm: string;
  currentWeightKg: string;
  targetWeightKg: string;
  activityLevel: ActivityLevel;
  dietPattern: DietPattern;
}

const INITIAL: WizardData = {
  goal: 'maintain',
  sex: '',
  age: '',
  heightCm: '',
  currentWeightKg: '',
  targetWeightKg: '',
  activityLevel: 'moderate',
  dietPattern: 'balanced',
};

function toNum(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function OnboardingPage() {
  return (
    <RequireAuth>
      <Wizard />
    </RequireAuth>
  );
}

function Wizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  const targets = useMemo(
    () =>
      computeTargets({
        age: toNum(data.age),
        sex: data.sex === '' ? null : data.sex,
        heightCm: toNum(data.heightCm),
        currentWeightKg: toNum(data.currentWeightKg),
        activityLevel: data.activityLevel,
        goal: data.goal,
        dietPattern: data.dietPattern,
      }),
    [data],
  );

  const statsValid =
    data.sex !== '' &&
    toNum(data.age) != null &&
    toNum(data.heightCm) != null &&
    toNum(data.currentWeightKg) != null;

  function finishFlag() {
    try {
      window.localStorage.setItem(ONBOARDED_FLAG, '1');
    } catch {
      /* non-critical */
    }
  }

  function skip() {
    finishFlag();
    router.replace('/');
  }

  async function finish() {
    setSaving(true);
    setError(null);
    const patch: UpdateProfile = {
      age: toNum(data.age),
      sex: data.sex === '' ? null : data.sex,
      heightCm: toNum(data.heightCm),
      currentWeightKg: toNum(data.currentWeightKg),
      targetWeightKg: toNum(data.targetWeightKg),
      activityLevel: data.activityLevel,
      goal: data.goal,
      dietPattern: data.dietPattern,
      autoTargets: true,
    };
    try {
      await updateProfile(patch);
      finishFlag();
      router.replace('/');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not save your profile.',
      );
      setSaving(false);
    }
  }

  const canAdvance = step !== 1 || statsValid;

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <header className={styles.top}>
          <span className={styles.brand}>
            <span aria-hidden="true">🥗</span> Let&rsquo;s set up your targets
          </span>
          <button type="button" className={styles.skip} onClick={skip}>
            Skip
          </button>
        </header>

        <div className={styles.progress} aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`${styles.dot} ${i <= step ? styles.dotOn : ''}`}
            />
          ))}
        </div>
        <p className={styles.stepLabel}>
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>

        <div className={styles.body}>
          {step === 0 && (
            <fieldset className={styles.choices}>
              <legend className={styles.legend}>What&rsquo;s your goal?</legend>
              {GOALS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  className={`${styles.choice} ${data.goal === g.value ? styles.choiceOn : ''}`}
                  aria-pressed={data.goal === g.value}
                  onClick={() => set('goal', g.value)}
                >
                  <span className={styles.choiceIcon} aria-hidden="true">
                    {g.icon}
                  </span>
                  <span className={styles.choiceText}>
                    <span className={styles.choiceLabel}>{g.label}</span>
                    <span className={styles.choiceSub}>{g.sub}</span>
                  </span>
                </button>
              ))}
            </fieldset>
          )}

          {step === 1 && (
            <div className={styles.form}>
              <div className={styles.field}>
                <span className={styles.legend}>Sex</span>
                <div className={styles.chips} role="group" aria-label="Sex">
                  {SEXES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      className="chip"
                      aria-pressed={data.sex === s.value}
                      onClick={() => set('sex', s.value)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.row}>
                <Num label="Age" value={data.age} onChange={(v) => set('age', v)} />
                <Num
                  label="Height (cm)"
                  value={data.heightCm}
                  onChange={(v) => set('heightCm', v)}
                />
              </div>
              <div className={styles.row}>
                <Num
                  label="Current weight (kg)"
                  value={data.currentWeightKg}
                  onChange={(v) => set('currentWeightKg', v)}
                />
                <Num
                  label="Target weight (kg) — optional"
                  value={data.targetWeightKg}
                  onChange={(v) => set('targetWeightKg', v)}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <fieldset className={styles.choices}>
              <legend className={styles.legend}>How active are you?</legend>
              {ACTIVITIES.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  className={`${styles.choice} ${data.activityLevel === a.value ? styles.choiceOn : ''}`}
                  aria-pressed={data.activityLevel === a.value}
                  onClick={() => set('activityLevel', a.value)}
                >
                  <span className={styles.choiceText}>
                    <span className={styles.choiceLabel}>{a.label}</span>
                    <span className={styles.choiceSub}>{a.sub}</span>
                  </span>
                </button>
              ))}
            </fieldset>
          )}

          {step === 3 && (
            <fieldset className={styles.choices}>
              <legend className={styles.legend}>Pick a diet style</legend>
              {DietPatternSchema.options.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`${styles.choice} ${data.dietPattern === d ? styles.choiceOn : ''}`}
                  aria-pressed={data.dietPattern === d}
                  onClick={() => set('dietPattern', d)}
                >
                  <span className={styles.choiceText}>
                    <span className={styles.choiceLabel}>
                      {DIET_PATTERN_LABELS[d]}
                    </span>
                    <span className={styles.choiceSub}>{DIET_BLURBS[d]}</span>
                  </span>
                </button>
              ))}
            </fieldset>
          )}

          {step === 4 && (
            <div className={styles.reveal}>
              <p className={styles.legend}>Here are your daily targets</p>
              {targets ? (
                <>
                  <div className={styles.calorieBig}>
                    <span className="num">
                      {targets.calorieTarget.toLocaleString()}
                    </span>
                    <span className={styles.calorieUnit}>kcal / day</span>
                  </div>
                  <div className={styles.macroRow}>
                    <Macro label="Protein" value={`${targets.proteinTarget}g`} icon="🥩" />
                    <Macro label="Carbs" value={`${targets.carbTarget}g`} icon="🌾" />
                    <Macro label="Fat" value={`${targets.fatTarget}g`} icon="🥑" />
                    <Macro
                      label="Water"
                      value={`${(targets.waterTargetMl / 1000).toFixed(1)}L`}
                      icon="💧"
                    />
                  </div>
                  <p className="subtle">
                    Estimated from your stats (Mifflin–St Jeor). You can fine-tune
                    these anytime in Profile, and they&rsquo;ll adapt as you log
                    weight.
                  </p>
                </>
              ) : (
                <p className="subtle">
                  Add your age, height, and weight to see suggested targets.
                </p>
              )}
            </div>
          )}
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className={styles.actions}>
          {step > 0 && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep((s) => s - 1)}
              disabled={saving}
            >
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void finish()}
              disabled={saving || !targets}
            >
              {saving ? 'Saving…' : 'Start tracking'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className={styles.numField}>
      <span>{label}</span>
      <input
        className="input"
        type="number"
        inputMode="decimal"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Macro({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className={styles.macro}>
      <span aria-hidden="true">{icon}</span>
      <span className={`num ${styles.macroVal}`}>{value}</span>
      <span className={styles.macroLabel}>{label}</span>
    </div>
  );
}
