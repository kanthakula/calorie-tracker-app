'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CreateMeal, FoodItem, MealType } from '@k21/validation';
import { getFoods, getFoodCategories, ApiError } from '@/lib/api';
import { healthForCategory } from '@/lib/health';
import { categoryEmoji } from '@/lib/emoji';
import styles from './FoodLibrary.module.css';

interface Props {
  date: string;
  mealType: MealType;
  onAdd: (meal: CreateMeal) => Promise<void> | void;
}

export function FoodLibrary({ date, mealType, onAdd }: Props) {
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [addingId, setAddingId] = useState<string | null>(null);

  // Load categories once.
  useEffect(() => {
    let cancelled = false;
    getFoodCategories()
      .then((c) => !cancelled && setCategories(c))
      .catch(() => {
        /* non-fatal: search still works */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced fetch when category/search changes.
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await getFoods({
          category: activeCategory ?? undefined,
          search: search.trim() || undefined,
        });
        setFoods(items);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError(
            err instanceof ApiError ? err.message : 'Could not load foods.',
          );
        }
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [activeCategory, search]);

  function getQty(id: string): number {
    return qty[id] ?? 1;
  }

  function setItemQty(id: string, value: number) {
    setQty((q) => ({ ...q, [id]: Math.max(1, Math.min(20, value)) }));
  }

  async function add(food: FoodItem) {
    const q = getQty(food.id);
    const meal: CreateMeal = {
      name: q > 1 ? `${food.name} ×${q}` : food.name,
      calories: Math.round(food.calories * q),
      type: mealType,
      date,
      protein: Math.round(food.protein * q),
      carbs: Math.round(food.carbs * q),
      fat: Math.round(food.fat * q),
      health: healthForCategory(food.category),
      source: 'library',
    };
    setAddingId(food.id);
    try {
      await onAdd(meal);
      setItemQty(food.id, 1);
    } finally {
      setAddingId(null);
    }
  }

  const chips = useMemo(() => ['All', ...categories], [categories]);

  return (
    <section className="card" aria-labelledby="library-heading">
      <h2 id="library-heading">Food library</h2>

      <div className="field">
        <label htmlFor="food-search">Search foods</label>
        <input
          id="food-search"
          className="input"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search e.g. banana, dal, paneer…"
        />
      </div>

      <div
        className={styles.chips}
        role="group"
        aria-label="Filter by category"
      >
        {chips.map((c) => {
          const isAll = c === 'All';
          const pressed = isAll ? activeCategory === null : activeCategory === c;
          return (
            <button
              key={c}
              type="button"
              className="chip"
              aria-pressed={pressed}
              onClick={() => setActiveCategory(isAll ? null : c)}
            >
              {!isAll && <span aria-hidden="true">{categoryEmoji(c)}</span>}
              {c}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <ul className={styles.list} aria-busy={loading}>
        {loading && foods.length === 0 && (
          <li className="subtle" style={{ padding: '0.5rem 0' }}>
            Loading foods…
          </li>
        )}
        {!loading && foods.length === 0 && (
          <li className="subtle" style={{ padding: '0.5rem 0' }}>
            No foods match. Try another search or category.
          </li>
        )}
        {foods.map((food) => {
          const q = getQty(food.id);
          return (
            <li key={food.id} className={styles.item}>
              <span className={styles.itemEmoji} aria-hidden="true">
                {categoryEmoji(food.category)}
              </span>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{food.name}</span>
                <span className="subtle">
                  {food.serving} · <span className="num">{food.calories}</span> kcal
                  · P{food.protein} C{food.carbs} F{food.fat}
                </span>
              </div>

              <div className={styles.stepper} aria-label={`Quantity for ${food.name}`}>
                <button
                  type="button"
                  className={styles.stepBtn}
                  onClick={() => setItemQty(food.id, q - 1)}
                  aria-label="Decrease quantity"
                  disabled={q <= 1}
                >
                  −
                </button>
                <span className={styles.qty} aria-live="polite">
                  {q}
                </span>
                <button
                  type="button"
                  className={styles.stepBtn}
                  onClick={() => setItemQty(food.id, q + 1)}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void add(food)}
                disabled={addingId === food.id}
              >
                {addingId === food.id ? 'Adding…' : 'Add'}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
