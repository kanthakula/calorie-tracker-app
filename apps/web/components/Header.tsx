'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Theme } from '@k21/validation';
import { useAuth } from '@/lib/auth';
import { useSettings } from '@/lib/settings';
import styles from './Header.module.css';

// 3-way cycle: System -> Light -> Dark -> System.
const THEME_ORDER: Theme[] = ['system', 'light', 'dark'];
const THEME_META: Record<Theme, { icon: string; label: string }> = {
  system: { icon: '🖥️', label: 'System' },
  light: { icon: '☀️', label: 'Light' },
  dark: { icon: '🌙', label: 'Dark' },
};

export function Header() {
  const { user, signOut } = useAuth();
  const { settings, theme, setTheme } = useSettings();
  const pathname = usePathname();

  const appName = settings?.appName ?? 'Ojas';
  const logoEmoji = settings?.logoEmoji ?? '🥗';

  function cycleTheme() {
    const idx = THEME_ORDER.indexOf(theme);
    setTheme(THEME_ORDER[(idx + 1) % THEME_ORDER.length]!);
  }

  const meta = THEME_META[theme];

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label={`${appName} home`}>
          <span className={styles.logo} aria-hidden="true">
            {logoEmoji}
          </span>
          <span className={styles.brandText}>{appName}</span>
        </Link>

        <nav className={styles.nav} aria-label="Primary">
          <Link
            href="/"
            className={styles.navLink}
            aria-current={pathname === '/' ? 'page' : undefined}
          >
            Today
          </Link>
          <Link
            href="/progress"
            className={styles.navLink}
            aria-current={pathname === '/progress' ? 'page' : undefined}
          >
            Progress
          </Link>
          <Link
            href="/history"
            className={styles.navLink}
            aria-current={pathname === '/history' ? 'page' : undefined}
          >
            History
          </Link>
          <Link
            href="/profile"
            className={styles.navLink}
            aria-current={pathname === '/profile' ? 'page' : undefined}
          >
            Profile
          </Link>
          <Link
            href="/admin"
            className={styles.navLink}
            aria-current={pathname === '/admin' ? 'page' : undefined}
          >
            Settings
          </Link>
        </nav>

        <div className={styles.account}>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={cycleTheme}
            aria-label={`Theme: ${meta.label}. Click to change.`}
            title={`Theme: ${meta.label}`}
          >
            <span aria-hidden="true">{meta.icon}</span>
          </button>
          {user && (
            <span className={styles.userName} title={user.email}>
              {user.name ?? user.email}
            </span>
          )}
          <button type="button" className="btn btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
