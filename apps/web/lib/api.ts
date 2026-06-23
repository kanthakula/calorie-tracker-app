// Typed fetch client for the K21 Node API.
//
// Responsibilities:
//  - Resolve the base URL from NEXT_PUBLIC_API_URL (default http://localhost:4000).
//  - Attach the user's Bearer token (from lib/auth) on authed requests.
//  - Attach the admin token via the `x-admin-token` header for admin requests.
//  - Parse JSON errors into a friendly ApiError.
//  - On a 401 from a user-authed request, clear auth and redirect to /login.
//  - Validate responses with @k21/validation schemas where practical.
import { z } from 'zod';
import {
  AuthResponseSchema,
  PublicUserSchema,
  MealSchema,
  DailyGoalSchema,
  FoodItemSchema,
  MealAnalysisSchema,
  BarcodeProductSchema,
  AdminConfigSchema,
  AppSettingsSchema,
  WorkoutSchema,
  WeightEntrySchema,
  StreakSchema,
  WeeklyCheckinSchema,
  WaterDaySchema,
  SavedMealSchema,
  RecipeSchema,
  FastSessionSchema,
  FastingStateSchema,
  type WaterDay,
  type LogWater,
  type SavedMeal,
  type CreateSavedMeal,
  type Recipe,
  type CreateRecipe,
  type FastSession,
  type FastingState,
  type Workout,
  type CreateWorkout,
  type LogWeight,
  type WeightEntry,
  type Streak,
  type WeeklyCheckin,
  type AppSettings,
  type UpdateAppSettings,
  type AuthResponse,
  type PublicUser,
  type Meal,
  type CreateMeal,
  type UpdateMeal,
  type DailyGoal,
  type FoodItem,
  type MealAnalysis,
  type BarcodeProduct,
  type AdminConfig,
  type UpdateAdminConfig,
  type Login,
  type Register,
  type UpdateProfile,
} from '@k21/validation';
import {
  MealSummarySchema,
  type MealSummary,
  ProfileResultSchema,
  type ProfileResult,
  WeightHistorySchema,
  type WeightHistory,
} from './types';
import { getToken, clearAuthAndRedirect } from './auth';

// Resolve the API base URL:
//  1. an explicit NEXT_PUBLIC_API_URL (set at build time) always wins;
//  2. otherwise use the SAME origin — Next rewrites /api/* to the Node API
//     server-side (see next.config.mjs). The browser only ever talks to this
//     host, so there's no CORS and HTTPS only needs to terminate in front of
//     the web app. Works identically over http and https, on any host/IP.
function resolveApiBase(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (explicit) return explicit;
  return '';
}

export const API_BASE = resolveApiBase();

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Attach the user Bearer token. Default true. */
  auth?: boolean;
  /** Attach the admin token header (x-admin-token) with this value. */
  adminToken?: string | null;
  /** Skip the automatic 401 -> redirect behavior (e.g. during login attempts). */
  noRedirectOn401?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    auth = true,
    adminToken,
    noRedirectOn401 = false,
    signal,
  } = opts;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  if (adminToken) headers['x-admin-token'] = adminToken;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(
      'Could not reach the server. Check that the API is running.',
      0,
      null,
    );
  }

  if (res.status === 401 && auth && !noRedirectOn401) {
    clearAuthAndRedirect();
    throw new ApiError('Your session expired. Please sign in again.', 401, null);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const message =
      (isRecord(data) && typeof data.message === 'string' && data.message) ||
      (isRecord(data) && typeof data.error === 'string' && data.error) ||
      `Request failed (${res.status})`;
    throw new ApiError(message, res.status, data);
  }

  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Parse with a schema; on failure, surface a clear ApiError rather than a raw ZodError. */
function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError('Unexpected response shape from server.', 0, result.error.format());
  }
  return result.data;
}

// --- Auth ---

export async function login(credentials: Login): Promise<AuthResponse> {
  const data = await request<unknown>('/api/auth/login', {
    method: 'POST',
    body: credentials,
    auth: false,
  });
  return parse(AuthResponseSchema, data);
}

export async function register(payload: Register): Promise<AuthResponse> {
  const data = await request<unknown>('/api/auth/register', {
    method: 'POST',
    body: payload,
    auth: false,
  });
  return parse(AuthResponseSchema, data);
}

export async function me(): Promise<PublicUser> {
  const data = await request<unknown>('/api/auth/me');
  return parse(PublicUserSchema, data);
}

// --- Meals ---

const MealArraySchema = z.array(MealSchema);

export async function getMealsByDate(date: string): Promise<Meal[]> {
  const data = await request<unknown>(`/api/meals?date=${encodeURIComponent(date)}`);
  return parse(MealArraySchema, data);
}

export async function getMealsByRange(from: string, to: string): Promise<Meal[]> {
  const data = await request<unknown>(
    `/api/meals?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  return parse(MealArraySchema, data);
}

export async function createMeal(meal: CreateMeal): Promise<Meal> {
  const data = await request<unknown>('/api/meals', { method: 'POST', body: meal });
  return parse(MealSchema, data);
}

export async function updateMeal(id: string, patch: UpdateMeal): Promise<Meal> {
  const data = await request<unknown>(`/api/meals/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: patch,
  });
  return parse(MealSchema, data);
}

export async function deleteMeal(id: string): Promise<void> {
  await request<void>(`/api/meals/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function getSummary(date: string): Promise<MealSummary> {
  const data = await request<unknown>(
    `/api/meals/summary?date=${encodeURIComponent(date)}`,
  );
  return parse(MealSummarySchema, data);
}

// --- Workouts ---

const WorkoutArraySchema = z.array(WorkoutSchema);

export async function getWorkouts(date: string): Promise<Workout[]> {
  const data = await request<unknown>(
    `/api/workouts?date=${encodeURIComponent(date)}`,
  );
  return parse(WorkoutArraySchema, data);
}

export async function createWorkout(workout: CreateWorkout): Promise<Workout> {
  const data = await request<unknown>('/api/workouts', {
    method: 'POST',
    body: workout,
  });
  return parse(WorkoutSchema, data);
}

export async function deleteWorkout(id: string): Promise<void> {
  await request<void>(`/api/workouts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// --- Weight (Sprint 6) ---

export async function getWeights(): Promise<WeightHistory> {
  const data = await request<unknown>('/api/weight');
  return parse(WeightHistorySchema, data);
}

export async function logWeight(entry: LogWeight): Promise<WeightEntry> {
  const data = await request<unknown>('/api/weight', {
    method: 'POST',
    body: entry,
  });
  return parse(WeightEntrySchema, data);
}

export async function deleteWeight(date: string): Promise<void> {
  await request<void>(`/api/weight/${encodeURIComponent(date)}`, {
    method: 'DELETE',
  });
}

// --- Recent meals (quick re-log) ---

const MealRecentArraySchema = z.array(MealSchema);

export async function getRecentMeals(): Promise<Meal[]> {
  const data = await request<unknown>('/api/meals/recent');
  return parse(MealRecentArraySchema, data);
}

// --- Insights (Sprint 6) ---

export async function getStreak(today: string): Promise<Streak> {
  const data = await request<unknown>(
    `/api/insights/streak?today=${encodeURIComponent(today)}`,
  );
  return parse(StreakSchema, data);
}

export async function getWeekly(weekEnd: string): Promise<WeeklyCheckin> {
  const data = await request<unknown>(
    `/api/insights/weekly?weekEnd=${encodeURIComponent(weekEnd)}`,
  );
  return parse(WeeklyCheckinSchema, data);
}

// --- Profile ---

export async function getProfile(): Promise<ProfileResult> {
  const data = await request<unknown>('/api/profile');
  return parse(ProfileResultSchema, data);
}

export async function updateProfile(patch: UpdateProfile): Promise<ProfileResult> {
  const data = await request<unknown>('/api/profile', { method: 'PUT', body: patch });
  return parse(ProfileResultSchema, data);
}

// --- Goal ---

export async function getGoal(date: string): Promise<DailyGoal> {
  const data = await request<unknown>(`/api/goal?date=${encodeURIComponent(date)}`);
  return parse(DailyGoalSchema, data);
}

export async function setGoal(
  date: string | null,
  calorieGoal: number,
): Promise<DailyGoal> {
  const data = await request<unknown>('/api/goal', {
    method: 'PUT',
    body: { date, calorieGoal },
  });
  return parse(DailyGoalSchema, data);
}

// --- Foods ---

const FoodArraySchema = z.array(FoodItemSchema);

export async function getFoods(params: {
  category?: string;
  search?: string;
}): Promise<FoodItem[]> {
  const qs = new URLSearchParams();
  if (params.category) qs.set('category', params.category);
  if (params.search) qs.set('search', params.search);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await request<unknown>(`/api/foods${suffix}`);
  return parse(FoodArraySchema, data);
}

export async function getFoodCategories(): Promise<string[]> {
  const data = await request<unknown>('/api/foods/categories');
  return parse(z.array(z.string()), data);
}

// --- AI analysis ---

export async function analyzeFood(
  imageBase64: string,
  mimeType: string,
): Promise<MealAnalysis> {
  const data = await request<unknown>('/api/analyze-food', {
    method: 'POST',
    body: { imageBase64, mimeType },
  });
  return parse(MealAnalysisSchema, data);
}

/** Analyze a free-text / voice meal description into the same structured shape. */
export async function analyzeText(text: string): Promise<MealAnalysis> {
  const data = await request<unknown>('/api/analyze-text', {
    method: 'POST',
    body: { text },
  });
  return parse(MealAnalysisSchema, data);
}

/** Look up a packaged product by its barcode (EAN/UPC) via the API. */
export async function lookupBarcode(code: string): Promise<BarcodeProduct> {
  const data = await request<unknown>(
    `/api/barcode/${encodeURIComponent(code)}`,
  );
  return parse(BarcodeProductSchema, data);
}

// --- Water (Sprint 7) ---

export async function getWater(date: string): Promise<WaterDay> {
  const data = await request<unknown>(
    `/api/water?date=${encodeURIComponent(date)}`,
  );
  return parse(WaterDaySchema, data);
}

export async function logWater(entry: LogWater): Promise<WaterDay> {
  const data = await request<unknown>('/api/water', {
    method: 'POST',
    body: entry,
  });
  return parse(WaterDaySchema, data);
}

// --- Saved meals / recipes (Sprint 7) ---

const SavedMealArraySchema = z.array(SavedMealSchema);

export async function getSavedMeals(): Promise<SavedMeal[]> {
  const data = await request<unknown>('/api/saved-meals');
  return parse(SavedMealArraySchema, data);
}

export async function createSavedMeal(meal: CreateSavedMeal): Promise<SavedMeal> {
  const data = await request<unknown>('/api/saved-meals', {
    method: 'POST',
    body: meal,
  });
  return parse(SavedMealSchema, data);
}

export async function deleteSavedMeal(id: string): Promise<void> {
  await request<void>(`/api/saved-meals/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// --- Recipes (multi-ingredient dishes) ---

const RecipeArraySchema = z.array(RecipeSchema);

export async function getRecipes(): Promise<Recipe[]> {
  const data = await request<unknown>('/api/recipes');
  return parse(RecipeArraySchema, data);
}

export async function createRecipe(recipe: CreateRecipe): Promise<Recipe> {
  const data = await request<unknown>('/api/recipes', {
    method: 'POST',
    body: recipe,
  });
  return parse(RecipeSchema, data);
}

export async function deleteRecipe(id: string): Promise<void> {
  await request<void>(`/api/recipes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// --- Intermittent fasting ---

export async function getFasting(): Promise<FastingState> {
  const data = await request<unknown>('/api/fasting');
  return parse(FastingStateSchema, data);
}

export async function startFast(targetHours: number): Promise<FastSession> {
  const data = await request<unknown>('/api/fasting/start', {
    method: 'POST',
    body: { targetHours },
  });
  return parse(FastSessionSchema, data);
}

export async function endFast(): Promise<FastSession> {
  const data = await request<unknown>('/api/fasting/end', { method: 'POST' });
  return parse(FastSessionSchema, data);
}

// --- App settings (branding + theme + feature flags) ---

/** PUBLIC — no auth. Clients fetch this to brand themselves and gate features. */
export async function getSettings(): Promise<AppSettings> {
  const data = await request<unknown>('/api/settings', { auth: false });
  return parse(AppSettingsSchema, data);
}

export async function getAdminSettings(adminToken: string): Promise<AppSettings> {
  const data = await request<unknown>('/api/admin/settings', {
    auth: false,
    adminToken,
    noRedirectOn401: true,
  });
  return parse(AppSettingsSchema, data);
}

export async function updateAdminSettings(
  adminToken: string,
  patch: UpdateAppSettings,
): Promise<AppSettings> {
  const data = await request<unknown>('/api/admin/settings', {
    method: 'POST',
    body: patch,
    auth: false,
    adminToken,
    noRedirectOn401: true,
  });
  return parse(AppSettingsSchema, data);
}

// --- Admin (owner-only; separate token, never the user JWT) ---

export async function adminLogin(
  username: string,
  password: string,
): Promise<{ token: string; expiresInMs: number }> {
  const data = await request<unknown>('/api/admin/login', {
    method: 'POST',
    body: { username, password },
    auth: false,
    noRedirectOn401: true,
  });
  return parse(z.object({ token: z.string(), expiresInMs: z.number() }), data);
}

export async function adminGetConfig(adminToken: string): Promise<AdminConfig> {
  const data = await request<unknown>('/api/admin/config', {
    auth: false,
    adminToken,
    noRedirectOn401: true,
  });
  return parse(AdminConfigSchema, data);
}

export async function adminUpdateConfig(
  adminToken: string,
  update: UpdateAdminConfig,
): Promise<AdminConfig> {
  const data = await request<unknown>('/api/admin/config', {
    method: 'POST',
    body: update,
    auth: false,
    adminToken,
    noRedirectOn401: true,
  });
  return parse(AdminConfigSchema, data);
}

export async function adminTest(adminToken: string): Promise<unknown> {
  return request<unknown>('/api/admin/test', {
    method: 'POST',
    auth: false,
    adminToken,
    noRedirectOn401: true,
  });
}
