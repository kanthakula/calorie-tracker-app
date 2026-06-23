# Assets

This directory intentionally ships **no binary image assets** (icons, splash
screens) so the repo stays text-only and `expo start` does not fail on missing
files referenced from `app.json`.

## TODO — add app icons before building a standalone app

Create the following PNGs here and wire them into `app.json` under `expo`:

| File                  | Size       | Config field                              |
| --------------------- | ---------- | ----------------------------------------- |
| `icon.png`            | 1024×1024  | `icon`                                    |
| `adaptive-icon.png`   | 1024×1024  | `android.adaptiveIcon.foregroundImage`    |
| `splash.png`          | ~1242×2436 | `plugins` → `expo-splash-screen` `image`  |
| `favicon.png`         | 48×48      | `web.favicon`                             |

Until these exist, the app runs fine in Expo Go / dev clients using Expo's
built-in defaults.
