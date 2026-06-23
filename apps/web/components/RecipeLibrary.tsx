'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  CreateMeal,
  CreateRecipe,
  FoodItem,
  MealType,
  Recipe,
  RecipeIngredientInput,
} from '@k21/validation';
import {
  getRecipes,
  createRecipe,
  deleteRecipe,
  getFoods,
  ApiError,
} from '@/lib/api';
import styles from './RecipeLibrary.module.css';

interface Props {
  date: string;
  mealType: MealType;
  onAdd: (meal: CreateMeal) => Promise<void> | void;
  notify: (message: string) => void;
}

function toNum(s: string, fallback = 0): number {
  const n = Number.parseInt(s.trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function sumMacros(items: RecipeIngredientInput[]) {
  return items.reduce(
    (acc, i) => ({
      calories: acc.calories + i.calories,
      protein: acc.protein + i.protein,
      carbs: acc.carbs + i.carbs,
      fat: acc.fat + i.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/**
 * Recipe library 🍲. Lists saved multi-ingredient dishes (log N servings in one
 * tap, macros scaled per serving) and a builder that composes ingredients from
 * the food library or manual entry, showing live totals + per-serving preview.
 */
export function RecipeLibrary({ date, mealType, onAdd, notify }: Props) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [servingsToLog, setServingsToLog] = useState<Record<string, number>>({});
  const [showBuilder, setShowBuilder] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getRecipes();
        if (!cancelled) setRecipes(res);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof ApiError ? err.message : 'Could not load recipes.',
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function logRecipe(r: Recipe) {
    const n = Math.max(1, servingsToLog[r.id] ?? 1);
    setPending(r.id);
    const meal: CreateMeal = {
      name: n === 1 ? r.name : `${r.name} ×${n}`,
      calories: Math.round((r.calories * n) / r.servings),
      type: mealType,
      date,
      protein: Math.round((r.protein * n) / r.servings),
      carbs: Math.round((r.carbs * n) / r.servings),
      fat: Math.round((r.fat * n) / r.servings),
      health: 0,
      source: 'recipe',
    };
    try {
      await onAdd(meal);
    } catch {
      /* upstream surfaces the error toast */
    } finally {
      setPending(null);
    }
  }

  async function remove(r: Recipe) {
    try {
      await deleteRecipe(r.id);
      setRecipes((prev) => prev.filter((x) => x.id !== r.id));
      notify(`Removed ${r.name}`);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not remove recipe');
    }
  }

  function onCreated(created: Recipe) {
    setRecipes((prev) => [created, ...prev]);
    setShowBuilder(false);
    notify(`Saved recipe ${created.name}`);
  }

  return (
    <section className={`card ${styles.card}`} aria-labelledby="recipe-heading">
      <div className={styles.head}>
        <h2 id="recipe-heading" className={styles.heading}>
          <span aria-hidden="true">🍲</span> Recipes
        </h2>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setShowBuilder((s) => !s)}
          aria-expanded={showBuilder}
        >
          {showBuilder ? 'Close' : '＋ Build a recipe'}
        </button>
      </div>

      <p className="subtle" style={{ marginTop: '-0.3rem' }}>
        Compose a dish once, then log a serving (or several) in one tap.
      </p>

      {showBuilder && <RecipeBuilder onCreated={onCreated} notify={notify} />}

      {loading ? (
        <p className="subtle">Loading recipes…</p>
      ) : error ? (
        <p className="subtle">{error}</p>
      ) : recipes.length === 0 ? (
        <p className="subtle">
          No recipes yet — build a go-to dish and log it by the serving.
        </p>
      ) : (
        <ul className={styles.list} aria-label="Recipes">
          {recipes.map((r) => {
            const perCal = Math.round(r.calories / r.servings);
            const perP = Math.round(r.protein / r.servings);
            const perC = Math.round(r.carbs / r.servings);
            const perF = Math.round(r.fat / r.servings);
            const n = Math.max(1, servingsToLog[r.id] ?? 1);
            return (
              <li key={r.id} className={styles.item}>
                <div className={styles.itemMain}>
                  <span className={styles.itemName}>{r.name}</span>
                  <span className={styles.itemMeta}>
                    <span className="num">{perCal.toLocaleString()}</span> kcal
                    <span className={styles.dot} aria-hidden="true">
                      ·
                    </span>
                    <span className="num">{perP}</span>P
                    <span className="num">{perC}</span>C
                    <span className="num">{perF}</span>F
                    <span className={styles.dot} aria-hidden="true">
                      ·
                    </span>
                    per serving · makes {r.servings}
                  </span>
                </div>
                <div className={styles.itemActions}>
                  <label className={styles.servings}>
                    <span className="sr-only">Servings to log</span>
                    <input
                      type="number"
                      className="input"
                      min={1}
                      max={20}
                      value={n}
                      onChange={(e) =>
                        setServingsToLog((prev) => ({
                          ...prev,
                          [r.id]: Math.max(1, toNum(e.target.value, 1)),
                        }))
                      }
                      aria-label={`Servings of ${r.name} to log`}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void logRecipe(r)}
                    disabled={pending === r.id}
                    aria-label={`Log ${n} serving(s) of ${r.name}`}
                  >
                    {pending === r.id ? '…' : '+ Log'}
                  </button>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => void remove(r)}
                    aria-label={`Delete recipe ${r.name}`}
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---- Builder ----

function RecipeBuilder({
  onCreated,
  notify,
}: {
  onCreated: (r: Recipe) => void;
  notify: (message: string) => void;
}) {
  const [name, setName] = useState('');
  const [servings, setServings] = useState('1');
  const [ingredients, setIngredients] = useState<RecipeIngredientInput[]>([]);
  const [saving, setSaving] = useState(false);

  // Food-library search
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Manual ingredient
  const [showManual, setShowManual] = useState(false);
  const [m, setM] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = term.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await getFoods({ search: q }));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [term]);

  function addFromFood(food: FoodItem) {
    const q = Math.max(1, qty[food.id] ?? 1);
    setIngredients((prev) => [
      ...prev,
      {
        name: q > 1 ? `${food.name} ×${q}` : food.name,
        calories: Math.round(food.calories * q),
        protein: Math.round(food.protein * q),
        carbs: Math.round(food.carbs * q),
        fat: Math.round(food.fat * q),
      },
    ]);
  }

  function addManual(e: FormEvent) {
    e.preventDefault();
    const nm = m.name.trim();
    const cal = toNum(m.calories);
    if (!nm || cal <= 0) {
      notify('An ingredient needs a name and calories.');
      return;
    }
    setIngredients((prev) => [
      ...prev,
      {
        name: nm,
        calories: cal,
        protein: toNum(m.protein),
        carbs: toNum(m.carbs),
        fat: toNum(m.fat),
      },
    ]);
    setM({ name: '', calories: '', protein: '', carbs: '', fat: '' });
  }

  function removeIngredient(idx: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  }

  const totals = sumMacros(ingredients);
  const srv = Math.max(1, toNum(servings, 1));

  async function save() {
    const nm = name.trim();
    if (!nm) {
      notify('Give your recipe a name.');
      return;
    }
    if (ingredients.length === 0) {
      notify('Add at least one ingredient.');
      return;
    }
    setSaving(true);
    try {
      const payload: CreateRecipe = { name: nm, servings: srv, ingredients };
      const created = await createRecipe(payload);
      setName('');
      setServings('1');
      setIngredients([]);
      onCreated(created);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not save recipe');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.builder}>
      <div className={styles.builderTop}>
        <div className="field" style={{ gap: '0.2rem', flex: 2 }}>
          <label htmlFor="recipe-name">Recipe name</label>
          <input
            id="recipe-name"
            className="input"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Chicken & rice bowl"
          />
        </div>
        <div className="field" style={{ gap: '0.2rem', flex: 1 }}>
          <label htmlFor="recipe-servings">Servings</label>
          <input
            id="recipe-servings"
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            value={servings}
            onChange={(e) => setServings(e.target.value)}
          />
        </div>
      </div>

      {/* Ingredient search from the food library */}
      <div className="field" style={{ gap: '0.2rem' }}>
        <label htmlFor="recipe-search">Add ingredients from the library</label>
        <input
          id="recipe-search"
          className="input"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search foods (e.g. rice, chicken)…"
        />
      </div>
      {term.trim().length >= 2 && (
        <ul className={styles.results} aria-label="Search results">
          {searching && <li className="subtle">Searching…</li>}
          {!searching && results.length === 0 && (
            <li className="subtle">No matches.</li>
          )}
          {results.slice(0, 8).map((f) => {
            const q = Math.max(1, qty[f.id] ?? 1);
            return (
              <li key={f.id} className={styles.result}>
                <span className={styles.resultName}>
                  {f.name}
                  <span className="subtle">
                    {' '}
                    · <span className="num">{f.calories}</span> kcal / {f.serving}
                  </span>
                </span>
                <input
                  type="number"
                  className="input"
                  min={1}
                  max={20}
                  value={q}
                  onChange={(e) =>
                    setQty((prev) => ({
                      ...prev,
                      [f.id]: Math.max(1, toNum(e.target.value, 1)),
                    }))
                  }
                  aria-label={`Quantity of ${f.name}`}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => addFromFood(f)}
                >
                  Add
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        className={styles.manualToggle}
        onClick={() => setShowManual((s) => !s)}
        aria-expanded={showManual}
      >
        {showManual ? '− Hide custom ingredient' : '＋ Add a custom ingredient'}
      </button>
      {showManual && (
        <form className={styles.manual} onSubmit={addManual}>
          <input
            className="input"
            placeholder="Ingredient name"
            value={m.name}
            onChange={(e) => setM({ ...m, name: e.target.value })}
            aria-label="Ingredient name"
          />
          <div className={styles.manualGrid}>
            <input
              className="input"
              type="number"
              min={0}
              placeholder="kcal"
              value={m.calories}
              onChange={(e) => setM({ ...m, calories: e.target.value })}
              aria-label="Calories"
            />
            <input
              className="input"
              type="number"
              min={0}
              placeholder="P"
              value={m.protein}
              onChange={(e) => setM({ ...m, protein: e.target.value })}
              aria-label="Protein grams"
            />
            <input
              className="input"
              type="number"
              min={0}
              placeholder="C"
              value={m.carbs}
              onChange={(e) => setM({ ...m, carbs: e.target.value })}
              aria-label="Carbs grams"
            />
            <input
              className="input"
              type="number"
              min={0}
              placeholder="F"
              value={m.fat}
              onChange={(e) => setM({ ...m, fat: e.target.value })}
              aria-label="Fat grams"
            />
            <button type="submit" className="btn btn-ghost">
              Add
            </button>
          </div>
        </form>
      )}

      {/* Current ingredients + running total */}
      {ingredients.length > 0 && (
        <div className={styles.ingredients}>
          <ul aria-label="Recipe ingredients">
            {ingredients.map((i, idx) => (
              <li key={idx} className={styles.ingredient}>
                <span className={styles.ingName}>{i.name}</span>
                <span className="subtle">
                  <span className="num">{i.calories}</span> kcal
                </span>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeIngredient(idx)}
                  aria-label={`Remove ${i.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.totals}>
            <span>
              Total <span className="num">{totals.calories.toLocaleString()}</span>{' '}
              kcal · <span className="num">{totals.protein}</span>P{' '}
              <span className="num">{totals.carbs}</span>C{' '}
              <span className="num">{totals.fat}</span>F
            </span>
            <span className={styles.perServing}>
              ≈ <span className="num">{Math.round(totals.calories / srv)}</span>{' '}
              kcal / serving
            </span>
          </div>
        </div>
      )}

      <div className={styles.builderActions}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save recipe'}
        </button>
      </div>
    </div>
  );
}
