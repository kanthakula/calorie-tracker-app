// Typed fetch client for the K21 Node API (React Native).
//
// Responsibilities:
//  - Resolve the base URL from EXPO_PUBLIC_API_URL (default http://localhost:4000).
//  - Attach the user's Bearer token on authed requests.
//  - Parse JSON errors into a friendly ApiError.
//  - On a 401 from an authed request, invoke the registered unauthorized handler
//    (lib/auth wires this to sign the user out, which routes back to /login).
//  - Validate responses with @k21/validation schemas where practical.
import { z } from 'zod';
import {
  AuthResponseSchema,
  PublicUserSchema,
  MealSchema,
  DailyGoalSchema,
  FoodItemSchema,
  AnalyzeFoodResponseSchema,
  type AuthResponse,
  type PublicUser,
  type Meal,
  type CreateMeal,
  type UpdateMeal,
  type DailyGoal,
  type FoodItem,
  type AnalyzeFoodResponse,
  type Login,
  type Register,
} from '@k21/validation';
import { MealSummarySchema, type MealSummary } from './types';

export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') ?? 'http://localhost:4000';

// --- Bridge to the auth layer (set from lib/auth) -------------------------

let tokenAccessor: () => string | null = () => null;
let unauthorizedHandler: () => void = () => {};

/** Register how the client reads the current token (called by AuthProvider). */
export function setTokenAccessor(fn: () => string | null): void {
  tokenAccessor = fn;
}

/** Register what happens on a 401 (called by AuthProvider -> signOut). */
export function setUnauthorizedHandler(fn: () => void): void {
  unauthorizedHandler = fn;
}

// --- Error type -----------------------------------------------------------

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
  /** Skip the automatic 401 -> sign-out behavior (e.g. during login attempts). */
  noSignOutOn401?: boolean;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, noSignOutOn401 = false, signal } = opts;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = tokenAccessor();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

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
      'Could not reach the server. Check EXPO_PUBLIC_API_URL and that the API is running.',
      0,
      null,
    );
  }

  if (res.status === 401 && auth && !noSignOutOn401) {
    unauthorizedHandler();
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

/** Parse with a schema; on failure surface a clear ApiError, not a raw ZodError. */
function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError('Unexpected response shape from server.', 0, result.error.format());
  }
  return result.data;
}

// --- Auth -----------------------------------------------------------------

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

// --- Meals ----------------------------------------------------------------

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

// --- Goal -----------------------------------------------------------------

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

// --- Foods ----------------------------------------------------------------

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

// --- AI analysis ----------------------------------------------------------

export async function analyzeFood(
  imageBase64: string,
  mimeType: string,
): Promise<AnalyzeFoodResponse> {
  const data = await request<unknown>('/api/analyze-food', {
    method: 'POST',
    body: { imageBase64, mimeType },
  });
  return parse(AnalyzeFoodResponseSchema, data);
}
