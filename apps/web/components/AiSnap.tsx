'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from '@zxing/browser';
import type {
  CreateMeal,
  FoodItemAnalysis,
  MealAnalysis,
  MealType,
  NutrientSource,
  NutritionTotal,
} from '@k21/validation';
import { analyzeFood, analyzeText, lookupBarcode, ApiError } from '@/lib/api';
import { downscaleToJpegBase64, type EncodedImage } from '@/lib/image';
import styles from './AiSnap.module.css';

interface Props {
  date: string;
  mealType: MealType;
  onAdd: (meal: CreateMeal) => Promise<void> | void;
  /** Hide the built-in heading when a collapsible Section already labels it. */
  headless?: boolean;
}

/**
 * An editable row in the correction loop. We keep the item's ORIGINAL grams +
 * macros so portion scaling is always derived from the source numbers (never
 * compounding rounding errors across repeated scalings).
 */
interface EditItem {
  key: string;
  name: string;
  source: NutrientSource;
  confidence: FoodItemAnalysis['confidence'];
  ref?: string;
  /** Current (possibly scaled/edited) portion in grams. */
  quantityG: number;
  /** Immutable baseline the scaling is computed from. */
  original: {
    quantityG: number;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
}

const SOURCE_META: Record<NutrientSource, { emoji: string; label: string }> = {
  vision: { emoji: '🔎', label: 'Vision' },
  usda: { emoji: '✅', label: 'USDA' },
  openfoodfacts: { emoji: '🏷️', label: 'Open Food Facts' },
  barcode: { emoji: '🏷️', label: 'Barcode' },
  manual: { emoji: '✏️', label: 'Manual' },
};

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `item-${keySeq}`;
}

function toEditItem(item: FoodItemAnalysis): EditItem {
  return {
    key: nextKey(),
    name: item.name,
    source: item.source,
    confidence: item.confidence,
    ref: item.ref ?? undefined,
    quantityG: item.quantityG,
    original: {
      quantityG: item.quantityG,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
    },
  };
}

/** Scaled, rounded macros for an item at its current portion. */
function scaled(item: EditItem): {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
} {
  const base = item.original.quantityG;
  const factor = base > 0 ? item.quantityG / base : 0;
  return {
    calories: Math.round(item.original.calories * factor),
    protein_g: Math.round(item.original.protein_g * factor),
    carbs_g: Math.round(item.original.carbs_g * factor),
    fat_g: Math.round(item.original.fat_g * factor),
  };
}

function computeTotal(items: EditItem[]): NutritionTotal {
  return items.reduce<NutritionTotal>(
    (acc, item) => {
      const s = scaled(item);
      return {
        calories: acc.calories + s.calories,
        protein_g: acc.protein_g + s.protein_g,
        carbs_g: acc.carbs_g + s.carbs_g,
        fat_g: acc.fat_g + s.fat_g,
      };
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

export function AiSnap({ date, mealType, onAdd, headless = false }: Props) {
  const [image, setImage] = useState<EncodedImage | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  // Correction-loop state: once we have any items (from a photo or a barcode),
  // we show the editable list. `meta` carries the analysis-level fields.
  const [items, setItems] = useState<EditItem[] | null>(null);
  const [meta, setMeta] = useState<{
    healthiness_rating: number;
    confidence: MealAnalysis['confidence'];
    notes: string;
    provider: string;
    model: string;
  } | null>(null);
  const [mealName, setMealName] = useState('');

  // Text / voice logging: a free-text description that resolves to the SAME
  // editable correction loop as the photo flow.
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const handleBlob = useCallback(async (blob: Blob) => {
    setError(null);
    setItems(null);
    setMeta(null);
    setAdded(false);
    try {
      const encoded = await downscaleToJpegBase64(blob);
      setImage(encoded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that image.');
    }
  }, []);

  // Paste-from-clipboard (Ctrl+V) support while this section is mounted.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith('image/'),
      );
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        void handleBlob(file);
      }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleBlob]);

  function applyAnalysis(res: MealAnalysis) {
    const edit = res.items.map(toEditItem);
    setItems(edit);
    setMeta({
      healthiness_rating: res.healthiness_rating,
      confidence: res.confidence,
      notes: res.notes,
      provider: res.provider,
      model: res.model,
    });
    setMealName(defaultName(edit));
    setAdded(false);
  }

  async function runAnalysis() {
    if (!image) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await analyzeFood(image.imageBase64, image.mimeType);
      applyAnalysis(res);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Analysis failed. Please try again.',
      );
    } finally {
      setAnalyzing(false);
    }
  }

  const runTextAnalysis = useCallback(
    async (raw: string) => {
      const desc = raw.trim();
      if (!desc) return;
      setAnalyzing(true);
      setError(null);
      setItems(null);
      setMeta(null);
      setAdded(false);
      try {
        const res = await analyzeText(desc);
        applyAnalysis(res);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Could not analyze that description. Please try again.',
        );
      } finally {
        setAnalyzing(false);
      }
    },
    // applyAnalysis is a stable closure over setState setters only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
    setListening(false);
  }, []);

  // Start Web Speech recognition; transcript fills the input and auto-submits.
  function startListening() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || !speechSecure()) return;
    setError(null);
    let rec: SpeechRecognitionLike;
    try {
      rec = new Ctor();
    } catch {
      return;
    }
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: SpeechRecognitionEventLike) => {
      const transcript = e.results?.[0]?.[0]?.transcript ?? '';
      if (transcript) {
        setText(transcript);
        void runTextAnalysis(transcript);
      }
    };
    rec.onerror = () => {
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      recognitionRef.current = null;
    }
  }

  // Stop any in-flight recognition on unmount.
  useEffect(() => stopListening, [stopListening]);

  const voiceSupported = getSpeechRecognitionCtor() !== null && speechSecure();

  /** Add a single resolved item (e.g. from a barcode) to the editable list. */
  const addResolvedItem = useCallback((item: FoodItemAnalysis) => {
    setAdded(false);
    setItems((prev) => {
      const next = [...(prev ?? []), toEditItem(item)];
      setMealName((name) => (name.trim() ? name : defaultName(next)));
      return next;
    });
    setMeta((prev) =>
      prev ?? {
        healthiness_rating: 0,
        confidence: item.confidence,
        notes: '',
        provider: 'barcode',
        model: 'open-food-facts',
      },
    );
  }, []);

  function updateItem(key: string, patch: Partial<EditItem>) {
    setItems((prev) =>
      prev
        ? prev.map((it) => (it.key === key ? { ...it, ...patch } : it))
        : prev,
    );
    setAdded(false);
  }

  function removeItem(key: string) {
    setItems((prev) => (prev ? prev.filter((it) => it.key !== key) : prev));
    setAdded(false);
  }

  async function addAsMeal() {
    if (!items || items.length === 0 || !meta) return;
    const total = computeTotal(items);
    const meal: CreateMeal = {
      name: mealName.trim() || defaultName(items) || 'Photo meal',
      calories: total.calories,
      type: mealType,
      date,
      protein: total.protein_g,
      carbs: total.carbs_g,
      fat: total.fat_g,
      health: meta.healthiness_rating,
      source: 'ai',
    };
    await onAdd(meal);
    setAdded(true);
    reset();
  }

  function reset() {
    setImage(null);
    setItems(null);
    setMeta(null);
    setMealName('');
    setText('');
    setError(null);
    stopListening();
    if (fileRef.current) fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  }

  const total = items ? computeTotal(items) : null;
  const hasItems = items !== null && items.length > 0;
  const emptyResult = items !== null && items.length === 0;

  return (
    <section
      className={`card ${styles.card}`}
      aria-labelledby={headless ? undefined : 'aisnap-heading'}
    >
      {!headless && (
        <h2 id="aisnap-heading" className={styles.title}>
          <span aria-hidden="true">📸</span> AI Snap
        </h2>
      )}
      <p className="subtle" style={{ marginTop: headless ? 0 : '-0.4rem' }}>
        Snap or upload a photo, or paste from your clipboard (Ctrl+V) — we&apos;ll
        identify the foods and estimate calories &amp; macros. You can fine-tune
        portions before logging.
      </p>

      <div className={styles.actions}>
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => cameraRef.current?.click()}
        >
          📷 Take a photo
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => fileRef.current?.click()}
        >
          📁 Upload
        </button>
        {(image || items) && (
          <button type="button" className="btn btn-ghost" onClick={reset}>
            Clear
          </button>
        )}
        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleBlob(f);
          }}
        />
        <input
          ref={cameraRef}
          className="sr-only"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleBlob(f);
          }}
        />
      </div>

      {image && (
        <div className={styles.previewRow}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.previewUrl}
            alt="Food to analyze"
            className={styles.preview}
          />
          {!items && (
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => void runAnalysis()}
              disabled={analyzing}
            >
              {analyzing ? 'Analyzing…' : 'Analyze food'}
            </button>
          )}
        </div>
      )}

      <div className={styles.textArea}>
        <span className={styles.textTitle}>
          <span aria-hidden="true">🎙️</span> Describe your meal
        </span>
        <form
          className={styles.textRow}
          onSubmit={(e) => {
            e.preventDefault();
            void runTextAnalysis(text);
          }}
        >
          <div className="field" style={{ flex: 1, gap: '0.2rem' }}>
            <label htmlFor="aisnap-text" className="sr-only">
              Describe your meal in words
            </label>
            <input
              id="aisnap-text"
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. 2 eggs and toast"
              disabled={listening}
            />
          </div>
          {voiceSupported && (
            <button
              type="button"
              className={`btn btn-ghost ${listening ? styles.micActive : ''}`}
              onClick={() => (listening ? stopListening() : startListening())}
              aria-pressed={listening}
              aria-label={
                listening ? 'Stop voice input' : 'Describe your meal by voice'
              }
              title={listening ? 'Stop listening' : 'Speak your meal'}
            >
              {listening ? '⏹' : '🎤'}
            </button>
          )}
          <button
            type="submit"
            className="btn btn-accent"
            disabled={analyzing || listening || !text.trim()}
          >
            {analyzing ? 'Analyzing…' : 'Submit'}
          </button>
        </form>
        {listening && (
          <p className={styles.listening} role="status">
            <span aria-hidden="true">🔴</span> Listening… speak now, then it&apos;ll
            analyze automatically.
          </p>
        )}
      </div>

      <BarcodeArea onItem={addResolvedItem} onError={setError} />

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      {emptyResult && (
        <div className={styles.result} aria-live="polite">
          <p className={styles.emptyState}>
            <span aria-hidden="true">🤔</span> No food detected — try another
            photo.
          </p>
          {meta?.notes && <p className="subtle">{meta.notes}</p>}
          <div className={styles.resultActions}>
            <button type="button" className="btn btn-ghost" onClick={reset}>
              Snap another
            </button>
          </div>
        </div>
      )}

      {hasItems && items && meta && total && (
        <div className={styles.result} aria-live="polite">
          <div className="field">
            <label htmlFor="aisnap-meal-name">Meal name</label>
            <input
              id="aisnap-meal-name"
              className="input"
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              placeholder="Photo meal"
            />
          </div>

          <ul className={styles.itemList}>
            {items.map((item) => (
              <ItemRow
                key={item.key}
                item={item}
                onChange={(patch) => updateItem(item.key, patch)}
                onRemove={() => removeItem(item.key)}
              />
            ))}
          </ul>

          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Total</span>
            <div className={styles.stats}>
              <Stat label="Calories" value={`${total.calories}`} unit="kcal" />
              <Stat label="Protein" value={`${total.protein_g}`} unit="g" />
              <Stat label="Carbs" value={`${total.carbs_g}`} unit="g" />
              <Stat label="Fat" value={`${total.fat_g}`} unit="g" />
            </div>
          </div>

          <div className={styles.metaRow}>
            {meta.healthiness_rating > 0 && (
              <p className={styles.health}>
                <span aria-hidden="true" className={styles.stars}>
                  {'★'.repeat(meta.healthiness_rating)}
                  {'☆'.repeat(5 - meta.healthiness_rating)}
                </span>
                <span className="subtle">
                  healthiness {meta.healthiness_rating}/5
                </span>
              </p>
            )}
            <ConfidenceBadge confidence={meta.confidence} prefix="Overall" />
          </div>

          {meta.notes && <p className="subtle">{meta.notes}</p>}

          <div className={styles.resultActions}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void addAsMeal()}
              disabled={added}
            >
              {added ? 'Added ✓' : 'Add to log'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={reset}>
              Discard
            </button>
          </div>

          {meta.provider && meta.model && (
            <p className={styles.provenance}>
              via {meta.provider} · {meta.model}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function defaultName(items: EditItem[]): string {
  const names = items.map((i) => i.name.trim()).filter(Boolean);
  if (names.length === 0) return 'Photo meal';
  return names.join(', ');
}

function ItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: EditItem;
  onChange: (patch: Partial<EditItem>) => void;
  onRemove: () => void;
}) {
  const s = scaled(item);
  const meta = SOURCE_META[item.source];
  const nameId = `${item.key}-name`;
  const qtyId = `${item.key}-qty`;

  function setMultiplier(mult: number) {
    onChange({ quantityG: Math.round(item.original.quantityG * mult) });
  }

  return (
    <li className={styles.item}>
      <div className={styles.itemHead}>
        <div className="field" style={{ flex: 1, gap: '0.2rem' }}>
          <label htmlFor={nameId} className="sr-only">
            Food name
          </label>
          <input
            id={nameId}
            className="input"
            value={item.name}
            onChange={(e) =>
              onChange({ name: e.target.value, source: 'manual' })
            }
          />
        </div>
        <button
          type="button"
          className={styles.removeBtn}
          onClick={onRemove}
          aria-label={`Remove ${item.name || 'item'}`}
          title="Remove"
        >
          ×
        </button>
      </div>

      <div className={styles.badges}>
        <ConfidenceBadge confidence={item.confidence} />
        <span className={styles.sourceBadge}>
          <span aria-hidden="true">{meta.emoji}</span> {meta.label}
        </span>
      </div>

      <div className={styles.portionRow}>
        <div className="field" style={{ gap: '0.2rem' }}>
          <label htmlFor={qtyId} className={styles.portionLabel}>
            Portion (g)
          </label>
          <input
            id={qtyId}
            className={`input ${styles.qtyInput}`}
            type="number"
            inputMode="numeric"
            min={0}
            step={5}
            value={item.quantityG}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              onChange({ quantityG: Number.isFinite(n) && n >= 0 ? n : 0 });
            }}
          />
        </div>
        <div
          className={styles.multipliers}
          role="group"
          aria-label="Quick portion scale"
        >
          <button
            type="button"
            className="chip"
            onClick={() => setMultiplier(0.5)}
          >
            ×0.5
          </button>
          <button type="button" className="chip" onClick={() => setMultiplier(1)}>
            ×1
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => setMultiplier(1.5)}
          >
            ×1.5
          </button>
        </div>
      </div>

      <div className={styles.itemStats}>
        <span className="num">{s.calories}</span>
        <span className={styles.unit}>kcal</span>
        <span className={styles.dot} aria-hidden="true">
          ·
        </span>
        <span className="num">{s.protein_g}</span>
        <span className={styles.unit}>P</span>
        <span className="num">{s.carbs_g}</span>
        <span className={styles.unit}>C</span>
        <span className="num">{s.fat_g}</span>
        <span className={styles.unit}>F</span>
      </div>
    </li>
  );
}

function ConfidenceBadge({
  confidence,
  prefix,
}: {
  confidence: 'low' | 'medium' | 'high';
  prefix?: string;
}) {
  return (
    <span className={`${styles.confidence} ${styles[`conf_${confidence}`]}`}>
      {prefix ? `${prefix}: ` : ''}
      {confidence} confidence
    </span>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>
        {value}
        <span className={styles.statUnit}>{unit}</span>
      </span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

// --- Voice input (Web Speech API) -------------------------------------------

/**
 * Minimal structural types for the Web Speech API, which is not part of the TS
 * DOM lib. We model only what we use and feature-detect at runtime.
 */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  results: { 0: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
interface SpeechRecognitionCtor {
  new (): SpeechRecognitionLike;
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function speechSecure(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.isSecureContext ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
}

// --- Barcode scanning (ZXing) -----------------------------------------------

/**
 * Camera barcode scanning powered by ZXing (`@zxing/browser`), which decodes
 * from the live camera in ALL modern browsers — including iOS Safari and
 * Firefox, where the Chromium-only native `BarcodeDetector` is unavailable.
 */
function BarcodeArea({
  onItem,
  onError,
}: {
  onItem: (item: FoodItemAnalysis) => void;
  onError: (msg: string | null) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  // ZXing controls for the active scan; calling .stop() releases the camera.
  const controlsRef = useRef<IScannerControls | null>(null);
  // Guards against React StrictMode double-invoke / overlapping start calls.
  const startingRef = useRef(false);

  // Camera scanning needs a secure context (https or localhost) and a working
  // getUserMedia. ZXing covers every modern browser, so no API feature-detect.
  const secureContext =
    typeof window !== 'undefined' &&
    (window.isSecureContext ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');
  const cameraScanAvailable =
    secureContext &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  const stopScan = useCallback(() => {
    const controls = controlsRef.current;
    if (controls) {
      try {
        controls.stop();
      } catch {
        /* already stopped */
      }
      controlsRef.current = null;
    }
    startingRef.current = false;
    setScanning(false);
  }, []);

  // Always release the camera on unmount.
  useEffect(() => stopScan, [stopScan]);

  async function doLookup(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    onError(null);
    setHint(null);
    setLookingUp(true);
    try {
      const product = await lookupBarcode(trimmed);
      if (product.found && product.item) {
        onItem(product.item);
        const label = product.brand
          ? `${product.brand} — ${product.name}`
          : product.name;
        setHint(`Added ${label}`);
        setManual('');
      } else {
        setHint('No product found for that barcode.');
      }
    } catch (err) {
      onError(
        err instanceof ApiError
          ? err.message
          : 'Barcode lookup failed. Please try again.',
      );
    } finally {
      setLookingUp(false);
    }
  }

  async function startScan() {
    if (!cameraScanAvailable) {
      setHint(
        'Open the app over https to scan with the camera, or enter the barcode below.',
      );
      return;
    }
    // Guard against StrictMode double-invoke / rapid re-clicks.
    if (startingRef.current || controlsRef.current) return;
    startingRef.current = true;
    onError(null);
    setHint(null);
    setScanning(true);

    const video = videoRef.current;
    if (!video) {
      stopScan();
      return;
    }

    try {
      const reader = new BrowserMultiFormatReader();
      // Prefer the rear (environment) camera. ZXing attaches the stream to our
      // <video> and returns controls we keep so we can stop it later.
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        video,
        (result) => {
          if (!result) return; // err fires continuously while searching — ignore
          const code = result.getText();
          stopScan();
          void doLookup(code);
        },
      );
      // If the user already stopped (or unmounted) while we were starting up,
      // tear the just-created stream right back down.
      if (!startingRef.current) {
        try {
          controls.stop();
        } catch {
          /* already stopped */
        }
        return;
      }
      controlsRef.current = controls;
      startingRef.current = false;
    } catch {
      stopScan();
      setHint('Could not access the camera. Enter the barcode below instead.');
    }
  }

  return (
    <div className={styles.barcode}>
      <div className={styles.barcodeHead}>
        <span className={styles.barcodeTitle}>
          <span aria-hidden="true">🏷️</span> Scan barcode
        </span>
        {!scanning && cameraScanAvailable && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void startScan()}
          >
            📷 Scan barcode
          </button>
        )}
        {scanning && (
          <span className={styles.scanStatus} role="status">
            <span aria-hidden="true">🔴</span> Scanning…
          </span>
        )}
        {scanning && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={stopScan}
            aria-label="Stop barcode scanning"
          >
            Stop
          </button>
        )}
      </div>

      {/* The <video> stays mounted so its ref is ready before we start the
          stream; it's only shown (and given height) while scanning. */}
      <div
        className={styles.scannerWrap}
        hidden={!scanning}
        aria-hidden={!scanning}
      >
        <video
          ref={videoRef}
          className={styles.scannerVideo}
          muted
          autoPlay
          playsInline
          aria-label="Live camera barcode scanner"
        />
        <span className={styles.scannerHint}>
          Point the camera at a barcode…
        </span>
      </div>

      {!cameraScanAvailable && (
        <p className="subtle" style={{ margin: 0 }}>
          Open the app over https to scan with the camera, or enter the barcode
          below.
        </p>
      )}

      <form
        className={styles.manualRow}
        onSubmit={(e) => {
          e.preventDefault();
          void doLookup(manual);
        }}
      >
        <div className="field" style={{ flex: 1, gap: '0.2rem' }}>
          <label htmlFor="aisnap-barcode" className={styles.portionLabel}>
            Or enter a barcode
          </label>
          <input
            id="aisnap-barcode"
            className="input"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="e.g. 5000159484695"
            value={manual}
            onChange={(e) =>
              setManual(e.target.value.replace(/[^0-9]/g, ''))
            }
          />
        </div>
        <button
          type="submit"
          className="btn btn-ghost"
          disabled={lookingUp || !manual.trim()}
        >
          {lookingUp ? 'Looking up…' : 'Look up'}
        </button>
      </form>

      {hint && (
        <p className="subtle" role="status" style={{ margin: '0.2rem 0 0' }}>
          {hint}
        </p>
      )}
    </div>
  );
}
