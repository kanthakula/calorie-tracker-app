'use client';

// App settings context: fetches PUBLIC /api/settings on mount and applies
// branding (document.title), the effective theme (data-theme on <html>), and the
// accent CSS custom properties. Also exposes feature flags so the tracker can
// gate sections, and a user-overridable theme persisted in localStorage.
//
// The user's theme override is intentionally separate from the owner's
// `defaultTheme`: if the user has never chosen, we follow the owner's default.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AppSettings, FeatureFlags, Theme } from '@k21/validation';
import { getSettings } from './api';

const THEME_KEY = 'k21.theme';

// Sensible fallbacks used before the public settings have loaded (and if the
// request fails). Features default to ON so we never flash-hide existing UI.
const FALLBACK_FEATURES: FeatureFlags = {
  aiSnap: true,
  foodLibrary: true,
  barcode: false,
  workouts: false,
  water: false,
};

function readThemeOverride(): Theme | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(THEME_KEY);
    return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : null;
  } catch {
    return null;
  }
}

function writeThemeOverride(theme: Theme | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (theme) window.localStorage.setItem(THEME_KEY, theme);
    else window.localStorage.removeItem(THEME_KEY);
  } catch {
    /* storage unavailable — ignore */
  }
}

/** Apply the effective theme to <html data-theme>. 'system' removes the attribute. */
function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  if (theme === 'system') delete el.dataset.theme;
  else el.dataset.theme = theme;
}

/** Apply accent colors as CSS custom properties on :root. */
function applyAccent(accent: string, accentStrong: string): void {
  if (typeof document === 'undefined') return;
  const style = document.documentElement.style;
  style.setProperty('--accent', accent);
  style.setProperty('--accent-strong', accentStrong);
}

interface SettingsContextValue {
  settings: AppSettings | null;
  features: FeatureFlags;
  ready: boolean;
  /** The active theme: the user override if set, otherwise the owner's default. */
  theme: Theme;
  setTheme: (theme: Theme) => void;
  refresh: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [ready, setReady] = useState(false);
  // The user's explicit override (null = follow owner default).
  const [override, setOverride] = useState<Theme | null>(null);

  // Effective theme: explicit override wins, else the owner's default, else system.
  const theme: Theme = override ?? settings?.defaultTheme ?? 'system';

  const refresh = useCallback(async () => {
    try {
      const next = await getSettings();
      setSettings(next);
    } catch {
      // Leave previous settings (or fallbacks) in place; never block the UI.
    } finally {
      setReady(true);
    }
  }, []);

  // Read the stored override before the first paint-affecting effect.
  useEffect(() => {
    setOverride(readThemeOverride());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Branding: document title.
  useEffect(() => {
    if (settings?.appName && typeof document !== 'undefined') {
      document.title = settings.appName;
    }
  }, [settings?.appName]);

  // Theme: re-apply whenever the effective theme changes.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Accent: re-apply whenever the owner's accent colors change.
  useEffect(() => {
    if (settings) applyAccent(settings.accentColor, settings.accentColor2);
  }, [settings?.accentColor, settings?.accentColor2, settings]);

  const setTheme = useCallback((next: Theme) => {
    setOverride(next);
    writeThemeOverride(next);
    applyTheme(next);
  }, []);

  const value: SettingsContextValue = {
    settings,
    features: settings?.features ?? FALLBACK_FEATURES,
    ready,
    theme,
    setTheme,
    refresh,
  };

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within <SettingsProvider>');
  return ctx;
}
