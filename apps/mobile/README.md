# @k21/mobile

The **K21 Calorie Tracker** mobile app — an [Expo](https://expo.dev) (React
Native) client written in TypeScript with [Expo Router](https://docs.expo.dev/router/introduction/)
(file-based routing). It talks to the same K21 Node API as the web app and shares
the data contract from `@k21/validation`.

## What it does

- **Login / Register** with a JWT, persisted via AsyncStorage. A
  **"Use demo account"** button signs in as `demo@k21.local` / `demo1234`.
- **Today** — date selector (step back through past days), daily summary
  (calories vs goal with a progress bar, remaining, P/C/F totals, editable
  goal), an insight card (headline + suggestion + average health), the day's
  meals with delete, and pull-to-refresh.
- **Add** — manual add form (name, calories, type, optional macros) plus a food
  library picker (category filter + search, quantity stepper; health derived
  from category).
- **Snap** — capture or pick a meal photo, downscale it (~1280px JPEG), send it
  to `/api/analyze-food`, review the AI estimate (calories, macros, healthiness,
  confidence, portion tip, provider/model), and add it as a meal.
- **History** — 7 / 14 / 30 / All range toggle with a daily-calorie bar chart
  (drawn with plain Views, no chart library) plus totals and per-day average.

## Prerequisites

- Node 20+ and pnpm 9 (managed at the monorepo root).
- The K21 Node API running and reachable (default `http://localhost:4000`).
- For device testing: the [Expo Go](https://expo.dev/go) app, or a custom dev
  client.

## Configure the API URL

Copy the example env file and set the API base URL:

```bash
cp .env.example .env
```

```
EXPO_PUBLIC_API_URL=http://localhost:4000
```

> **Physical device note (important):** `localhost` on your phone points at the
> phone itself, **not** your computer. To run on a real device, set
> `EXPO_PUBLIC_API_URL` to your development machine's **LAN IP**, e.g.
> `http://192.168.1.42:4000`. On Windows, run `ipconfig` to find your IPv4
> address. Your phone and computer must be on the same Wi-Fi network, and the
> API must bind to `0.0.0.0` (not just `127.0.0.1`).
>
> The iOS simulator and Expo web can use `http://localhost:4000`. The Android
> emulator typically uses `http://10.0.2.2:4000` to reach the host machine.

## Run

From the monorepo root:

```bash
pnpm --filter @k21/mobile start
```

Then, in the Expo CLI:

- press **i** — open the iOS simulator,
- press **a** — open the Android emulator,
- press **w** — open in a web browser,
- or scan the QR code with **Expo Go** on a physical device.

Convenience scripts:

```bash
pnpm --filter @k21/mobile ios
pnpm --filter @k21/mobile android
pnpm --filter @k21/mobile web
pnpm --filter @k21/mobile typecheck
```

## Permissions

The **Snap** feature requests:

- **Camera** — to photograph meals.
- **Photo library** — to choose existing photos.

These are declared in `app.json` (iOS `infoPlist` usage strings, Android
`CAMERA` / media permissions, and the `expo-image-picker` plugin). The app asks
for them at the moment you tap "Take photo" / "Choose from library".

## Assets

No binary icon/splash assets are committed (see `assets/README.md`). The app runs
on Expo's defaults; add real icons before producing a standalone build.

## Project layout

```
apps/mobile/
├── app/
│   ├── _layout.tsx          # Root Stack + auth gate + token load
│   ├── login.tsx            # Login / register (outside the tabs)
│   └── (tabs)/
│       ├── _layout.tsx      # Tab navigator
│       ├── index.tsx        # Today
│       ├── add.tsx          # Add (manual + library)
│       ├── snap.tsx         # AI photo analysis
│       └── history.tsx      # Trends / bar chart
├── components/              # SummaryCard, InsightCard, MealRow, FoodPicker, BarChart, …
├── lib/                     # api, auth, date, health, theme, types, useToday
├── assets/                  # (no binaries — see assets/README.md)
├── app.json  babel.config.js  metro.config.js  tsconfig.json  package.json
```
