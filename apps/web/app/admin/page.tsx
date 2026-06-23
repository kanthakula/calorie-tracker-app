'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type {
  AdminConfig,
  AppSettings,
  FeatureFlags,
  Provider,
  ProviderStatus,
  Theme,
  UpdateAdminConfig,
  UpdateAppSettings,
} from '@k21/validation';
import {
  adminLogin,
  adminGetConfig,
  adminUpdateConfig,
  adminTest,
  getAdminSettings,
  updateAdminSettings,
  ApiError,
} from '@/lib/api';
import { getAdminToken, setAdminToken } from '@/lib/admin';
import { useSettings } from '@/lib/settings';
import { useToast } from '@/components/useToast';
import styles from './admin.module.css';

type AdminTab = 'branding' | 'features' | 'ai';

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(getAdminToken());
    setReady(true);
  }, []);

  function onAuthed(t: string) {
    setAdminToken(t);
    setToken(t);
  }

  function signOut() {
    setAdminToken(null);
    setToken(null);
  }

  if (!ready) {
    return (
      <main className="app-main" id="main">
        <p className="subtle">Loading…</p>
      </main>
    );
  }

  return token ? (
    <AdminConsole token={token} onExpired={signOut} />
  ) : (
    <AdminLogin onAuthed={onAuthed} />
  );
}

function AdminLogin({ onAuthed }: { onAuthed: (token: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { token } = await adminLogin(username, password);
      onAuthed(token);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Login failed. Check the username and password.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.loginWrap} id="main">
      <form className={styles.loginCard} onSubmit={submit}>
        <h1 className={styles.title}>Admin console</h1>
        <p className="subtle">Owner-only settings.</p>
        <div className="field" style={{ marginTop: '1rem' }}>
          <label htmlFor="admin-user">Admin username</label>
          <input
            id="admin-user"
            className="input"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="field" style={{ marginTop: '0.75rem' }}>
          <label htmlFor="admin-pw">Admin password</label>
          <input
            id="admin-pw"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy}
          style={{ width: '100%', marginTop: '0.85rem' }}
        >
          {busy ? 'Signing in…' : 'Unlock'}
        </button>
      </form>
    </main>
  );
}

function AdminConsole({
  token,
  onExpired,
}: {
  token: string;
  onExpired: () => void;
}) {
  const [tab, setTab] = useState<AdminTab>('branding');

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'branding', label: 'Branding' },
    { id: 'features', label: 'Features' },
    { id: 'ai', label: 'AI / LLM' },
  ];

  return (
    <main className="app-main" id="main">
      <div className={styles.head}>
        <h1 className={styles.title}>Settings</h1>
        <button type="button" className="btn btn-ghost" onClick={onExpired}>
          Lock
        </button>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Settings sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className={styles.panel}
      >
        {tab === 'branding' && (
          <BrandingTab token={token} onExpired={onExpired} />
        )}
        {tab === 'features' && (
          <FeaturesTab token={token} onExpired={onExpired} />
        )}
        {tab === 'ai' && <AiConfigTab token={token} onExpired={onExpired} />}
      </div>
    </main>
  );
}

function AiConfigTab({
  token,
  onExpired,
}: {
  token: string;
  onExpired: () => void;
}) {
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Editable working copy.
  const [activeProvider, setActiveProvider] = useState<Provider>('gemini');
  const [models, setModels] = useState<Record<string, string>>({});
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [kimiBaseURL, setKimiBaseURL] = useState('');
  const { show, node: toast } = useToast();

  const hydrate = useCallback((cfg: AdminConfig) => {
    setConfig(cfg);
    setActiveProvider(cfg.activeProvider);
    setKimiBaseURL(cfg.kimiBaseURL);
    setModels(Object.fromEntries(cfg.providers.map((p) => [p.id, p.model])));
    setKeyInputs({});
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await adminGetConfig(token);
      hydrate(cfg);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onExpired();
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Could not load config.');
    } finally {
      setLoading(false);
    }
  }, [token, hydrate, onExpired]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save() {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      // Only send models that changed, and keys the owner actually typed.
      const changedModels: Record<string, string> = {};
      for (const p of config.providers) {
        const next = models[p.id];
        if (next !== undefined && next !== p.model) changedModels[p.id] = next;
      }
      const keys: Record<string, string | null> = {};
      for (const [id, val] of Object.entries(keyInputs)) {
        if (val === '__CLEAR__') keys[id] = null;
        else if (val.trim()) keys[id] = val.trim();
      }

      const update: UpdateAdminConfig = { provider: activeProvider };
      if (Object.keys(changedModels).length)
        update.models = changedModels as UpdateAdminConfig['models'];
      if (Object.keys(keys).length) update.keys = keys as UpdateAdminConfig['keys'];
      if (kimiBaseURL !== config.kimiBaseURL) update.kimiBaseURL = kimiBaseURL;

      const next = await adminUpdateConfig(token, update);
      hydrate(next);
      show('Settings saved');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onExpired();
      setError(err instanceof ApiError ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await adminTest(token);
      setTestResult(`✓ ${typeof res === 'string' ? res : JSON.stringify(res)}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onExpired();
      setTestResult(
        `✗ ${err instanceof ApiError ? err.message : 'Test failed.'}`,
      );
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <p className="subtle">Loading config…</p>;
  }

  return (
    <>
      {error && (
        <div className="card" role="alert">
          <p className="error-text">{error}</p>
        </div>
      )}

      {config && (
        <>
          <section className="card" aria-labelledby="provider-heading">
            <h2 id="provider-heading">Active provider</h2>
            <div
              className={styles.providerRadios}
              role="radiogroup"
              aria-label="Active AI provider"
            >
              {config.providers.map((p) => (
                <label
                  key={p.id}
                  className={`${styles.radio} ${activeProvider === p.id ? styles.radioActive : ''}`}
                >
                  <input
                    type="radio"
                    name="provider"
                    value={p.id}
                    checked={activeProvider === p.id}
                    onChange={() => setActiveProvider(p.id)}
                  />
                  <span className={styles.radioName}>{p.id}</span>
                </label>
              ))}
            </div>
          </section>

          {config.providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              isKimi={p.id === 'kimi'}
              model={models[p.id] ?? ''}
              onModelChange={(v) => setModels((m) => ({ ...m, [p.id]: v }))}
              keyInput={keyInputs[p.id] ?? ''}
              onKeyChange={(v) => setKeyInputs((k) => ({ ...k, [p.id]: v }))}
              onClearKey={() =>
                setKeyInputs((k) => ({ ...k, [p.id]: '__CLEAR__' }))
              }
              kimiBaseURL={kimiBaseURL}
              onKimiBaseURLChange={setKimiBaseURL}
            />
          ))}

          <section className={`card ${styles.actionsCard}`}>
            <div className={styles.actions}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void save()}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save settings'}
              </button>
              <button
                type="button"
                className="btn btn-accent"
                onClick={() => void runTest()}
                disabled={testing}
              >
                {testing ? 'Testing…' : 'Test active provider'}
              </button>
            </div>
            {testResult && (
              <p
                className={
                  testResult.startsWith('✓') ? styles.testOk : styles.testFail
                }
                role="status"
              >
                {testResult}
              </p>
            )}
          </section>
        </>
      )}
      {toast}
    </>
  );
}

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

function BrandingTab({
  token,
  onExpired,
}: {
  token: string;
  onExpired: () => void;
}) {
  const { refresh: refreshSettings } = useSettings();
  const { show, node: toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [appName, setAppName] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoEmoji, setLogoEmoji] = useState('');
  const [defaultTheme, setDefaultTheme] = useState<Theme>('system');
  const [accentColor, setAccentColor] = useState('#039855');
  const [accentColor2, setAccentColor2] = useState('#027a48');

  const hydrate = useCallback((s: AppSettings) => {
    setAppName(s.appName);
    setTagline(s.tagline);
    setLogoEmoji(s.logoEmoji);
    setDefaultTheme(s.defaultTheme);
    setAccentColor(s.accentColor);
    setAccentColor2(s.accentColor2);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      hydrate(await getAdminSettings(token));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onExpired();
      setError(err instanceof ApiError ? err.message : 'Could not load settings.');
    } finally {
      setLoading(false);
    }
  }, [token, hydrate, onExpired]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const update: UpdateAppSettings = {
        appName,
        tagline,
        logoEmoji,
        defaultTheme,
        accentColor,
        accentColor2,
      };
      hydrate(await updateAdminSettings(token, update));
      await refreshSettings();
      show('Branding saved');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onExpired();
      setError(err instanceof ApiError ? err.message : 'Could not save branding.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="subtle">Loading branding…</p>;

  return (
    <form onSubmit={save}>
      {error && (
        <div className="card" role="alert">
          <p className="error-text">{error}</p>
        </div>
      )}

      <section className="card" aria-labelledby="branding-heading">
        <h2 id="branding-heading">Branding</h2>

        <div className={styles.previewSwatch} aria-hidden="true">
          <span className={styles.previewLogo}>{logoEmoji || '🍽️'}</span>
          <div>
            <div className={styles.previewName}>{appName || 'App name'}</div>
            <div className="subtle">{tagline || 'Tagline goes here'}</div>
          </div>
          <div className={styles.previewAccents}>
            <span style={{ background: accentColor }} />
            <span style={{ background: accentColor2 }} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="appName">App name</label>
          <input
            id="appName"
            className="input"
            value={appName}
            maxLength={60}
            onChange={(e) => setAppName(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="tagline">Tagline</label>
          <input
            id="tagline"
            className="input"
            value={tagline}
            maxLength={120}
            onChange={(e) => setTagline(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="logoEmoji">Logo emoji</label>
          <input
            id="logoEmoji"
            className="input"
            value={logoEmoji}
            maxLength={8}
            onChange={(e) => setLogoEmoji(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="defaultTheme">Default theme</label>
          <select
            id="defaultTheme"
            className="select"
            value={defaultTheme}
            onChange={(e) => setDefaultTheme(e.target.value as Theme)}
          >
            {THEME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <ColorField
          id="accentColor"
          label="Accent color"
          value={accentColor}
          onChange={setAccentColor}
        />
        <ColorField
          id="accentColor2"
          label="Accent color (strong)"
          value={accentColor2}
          onChange={setAccentColor2}
        />
      </section>

      <section className={`card ${styles.actionsCard}`}>
        <div className={styles.actions}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save branding'}
          </button>
        </div>
      </section>
      {toast}
    </form>
  );
}

/** Hex color picker + text input that stay in sync. */
function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={styles.colorRow}>
        <input
          type="color"
          aria-label={`${label} picker`}
          className={styles.colorPicker}
          value={valid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          id={id}
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#RRGGBB"
          spellCheck={false}
        />
      </div>
      {!valid && (
        <span className="error-text">Enter a hex color like #RRGGBB</span>
      )}
    </div>
  );
}

const FEATURE_META: {
  id: keyof FeatureFlags;
  label: string;
  comingSoon?: boolean;
}[] = [
  { id: 'aiSnap', label: 'AI snap' },
  { id: 'foodLibrary', label: 'Food library' },
  { id: 'barcode', label: 'Barcode scanner' },
  { id: 'workouts', label: 'Workouts' },
  { id: 'water', label: 'Water tracking' },
];

function FeaturesTab({
  token,
  onExpired,
}: {
  token: string;
  onExpired: () => void;
}) {
  const { refresh: refreshSettings } = useSettings();
  const { show, node: toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [features, setFeatures] = useState<FeatureFlags | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await getAdminSettings(token);
      setFeatures(s.features);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onExpired();
      setError(err instanceof ApiError ? err.message : 'Could not load features.');
    } finally {
      setLoading(false);
    }
  }, [token, onExpired]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function toggle(id: keyof FeatureFlags) {
    setFeatures((f) => (f ? { ...f, [id]: !f[id] } : f));
  }

  async function save() {
    if (!features) return;
    setSaving(true);
    setError(null);
    try {
      const next = await updateAdminSettings(token, { features });
      setFeatures(next.features);
      await refreshSettings();
      show('Features saved');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onExpired();
      setError(err instanceof ApiError ? err.message : 'Could not save features.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="subtle">Loading features…</p>;

  return (
    <>
      {error && (
        <div className="card" role="alert">
          <p className="error-text">{error}</p>
        </div>
      )}

      {features && (
        <section className="card" aria-labelledby="features-heading">
          <h2 id="features-heading">Feature flags</h2>
          <div className={styles.featureList}>
            {FEATURE_META.map((f) => (
              <label key={f.id} className={styles.featureRow}>
                <span className={styles.featureLabel}>
                  {f.label}
                  {f.comingSoon && (
                    <span className={styles.comingSoon}>coming soon</span>
                  )}
                </span>
                <input
                  type="checkbox"
                  className={styles.toggle}
                  checked={features[f.id]}
                  onChange={() => toggle(f.id)}
                />
              </label>
            ))}
          </div>
        </section>
      )}

      <section className={`card ${styles.actionsCard}`}>
        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void save()}
            disabled={saving || !features}
          >
            {saving ? 'Saving…' : 'Save features'}
          </button>
        </div>
      </section>
      {toast}
    </>
  );
}

function ProviderCard({
  provider,
  isKimi,
  model,
  onModelChange,
  keyInput,
  onKeyChange,
  onClearKey,
  kimiBaseURL,
  onKimiBaseURLChange,
}: {
  provider: ProviderStatus;
  isKimi: boolean;
  model: string;
  onModelChange: (v: string) => void;
  keyInput: string;
  onKeyChange: (v: string) => void;
  onClearKey: () => void;
  kimiBaseURL: string;
  onKimiBaseURLChange: (v: string) => void;
}) {
  const cleared = keyInput === '__CLEAR__';
  const keyStatus = cleared
    ? { text: 'Will be cleared on save', cls: styles.keyWarn }
    : provider.hasKey
      ? {
          text: `Key set · source: ${provider.keySource}`,
          cls: styles.keyOk,
        }
      : { text: 'No key configured', cls: styles.keyNone };

  return (
    <section className={`card ${styles.providerCard}`}>
      <div className={styles.providerHead}>
        <h2 className={styles.providerTitle}>{provider.id}</h2>
        <span className={`${styles.keyBadge} ${keyStatus.cls}`}>
          {keyStatus.text}
        </span>
      </div>

      <div className="field">
        <label htmlFor={`model-${provider.id}`}>Model</label>
        <input
          id={`model-${provider.id}`}
          className="input"
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder={provider.defaultModel}
        />
        <span className="subtle">Default: {provider.defaultModel}</span>
      </div>

      <div className="field">
        <label htmlFor={`key-${provider.id}`}>
          API key {provider.hasKey ? '(replace)' : '(set)'}
        </label>
        <input
          id={`key-${provider.id}`}
          className="input"
          type="password"
          autoComplete="off"
          value={cleared ? '' : keyInput}
          onChange={(e) => onKeyChange(e.target.value)}
          placeholder={cleared ? '(cleared)' : 'Paste a new key to update'}
        />
        <span className="subtle">
          Keys are write-only — they are sent to the server and never displayed.
        </span>
        {provider.hasKey && provider.keySource === 'ui' && !cleared && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ alignSelf: 'flex-start', marginTop: '0.4rem' }}
            onClick={onClearKey}
          >
            Clear stored key
          </button>
        )}
      </div>

      {isKimi && (
        <div className="field">
          <label htmlFor="kimi-base">Kimi base URL</label>
          <input
            id="kimi-base"
            className="input"
            value={kimiBaseURL}
            onChange={(e) => onKimiBaseURLChange(e.target.value)}
            placeholder="https://api.moonshot.cn/v1"
          />
        </div>
      )}
    </section>
  );
}
