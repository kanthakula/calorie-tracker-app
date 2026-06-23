'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useSettings } from '@/lib/settings';
import { login, register, ApiError } from '@/lib/api';
import styles from './login.module.css';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const { token, ready, signIn } = useAuth();
  const { settings } = useSettings();
  const router = useRouter();

  const appName = settings?.appName ?? 'Ojas';
  const logoEmoji = settings?.logoEmoji ?? '🥗';

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in? Go to the tracker.
  useEffect(() => {
    if (ready && token) router.replace('/');
  }, [ready, token, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res =
        mode === 'login'
          ? await login({ email, password })
          : await register({ email, password, name: name.trim() || undefined });
      signIn(res.user, res.token);
      router.replace('/');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.wrap} id="main">
      <div className={styles.card}>
        <div className={styles.brand}>
          <span aria-hidden="true" className={styles.logo}>
            {logoEmoji}
          </span>
          <h1 className={styles.title}>
            <span className={styles.accent}>{appName}</span>
          </h1>
        </div>
        <p className={styles.tagline}>
          {mode === 'login'
            ? 'Welcome back. Sign in to log your meals.'
            : 'Create an account to start tracking.'}
        </p>

        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Sign in or register"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`}
            onClick={() => setMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`${styles.tab} ${mode === 'register' ? styles.tabActive : ''}`}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>

        <form className={styles.form} onSubmit={onSubmit} noValidate>
          {mode === 'register' && (
            <div className="field">
              <label htmlFor="name">Name (optional)</label>
              <input
                id="name"
                className="input"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              required
              minLength={mode === 'register' ? 8 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
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
            style={{ width: '100%' }}
          >
            {busy
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>
      </div>
    </main>
  );
}
