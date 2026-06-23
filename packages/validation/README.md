# @k21/validation

The **single source of truth** for the K21 data contract. Zod schemas (runtime
validation) plus inferred TypeScript types (compile-time), imported by the web
app, mobile app, and Node API so the JSON shape can never drift.

```ts
import { CreateMealSchema, type Meal, AnalyzeFoodResponseSchema } from '@k21/validation';

// Validate untrusted input on the server:
const meal = CreateMealSchema.parse(req.body);

// Validate an API response on the client:
const analysis = AnalyzeFoodResponseSchema.parse(await res.json());
```

## Contents
- `common` — enums/primitives: `Provider`, `MealType`, `MealSource`, `Confidence`,
  `IsoDate`, `ImageMimeType`, grams/calories/health scalars.
- `nutrition` — `FoodAnalysis` (the AI result contract), `AnalyzeFoodRequest/Response`.
- `meal` — `Meal`, `CreateMeal`, `UpdateMeal`, `MealQuery`, `DailyTotals`.
- `food` — `FoodItem`, `FoodCategory`, `FOOD_CATEGORIES`.
- `goal` — `DailyGoal`, `SetGoal`.
- `admin` — `AdminConfig` (masked), `UpdateAdminConfig`, `AdminLogin`.
- `auth` — `Register`, `Login`, `PublicUser`, `AuthResponse`.

## Scripts
- `pnpm build` — bundle to `dist/` (ESM + CJS + d.ts) via tsup.
- `pnpm test` — run schema tests (vitest).
