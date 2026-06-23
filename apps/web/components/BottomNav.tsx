'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import styles from './BottomNav.module.css';

type Tab = { href: string; label: string; icon: string };

// Two tabs sit on each side of the center "+" FAB.
const LEFT: Tab[] = [
  { href: '/', label: 'Today', icon: '🏠' },
  { href: '/progress', label: 'Progress', icon: '📈' },
];
const RIGHT: Tab[] = [
  { href: '/history', label: 'History', icon: '📊' },
  { href: '/profile', label: 'More', icon: '☰' },
];

/**
 * Mobile-first bottom navigation with a center quick-add FAB. Rendered globally
 * for authenticated routes. The FAB opens the quick-add sheet on Today; from any
 * other page it routes to Today with `?add=1` so the sheet opens on arrival.
 * On wide screens the bar is hidden (top header nav takes over) but the FAB
 * stays as a floating button for parity.
 */
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  // No chrome before sign-in, or during the focused onboarding flow.
  if (!user || pathname === '/login' || pathname === '/onboarding') return null;

  function openAdd() {
    if (pathname === '/') {
      window.dispatchEvent(new CustomEvent('k21:quickadd', { detail: {} }));
    } else {
      router.push('/?add=1');
    }
  }

  function tab(t: Tab) {
    const active = pathname === t.href;
    return (
      <Link
        key={t.href}
        href={t.href}
        className={`${styles.tab} ${active ? styles.tabActive : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        <span className={styles.tabIcon} aria-hidden="true">
          {t.icon}
        </span>
        <span className={styles.tabLabel}>{t.label}</span>
      </Link>
    );
  }

  return (
    <>
      <nav className={styles.bar} aria-label="Primary">
        {LEFT.map(tab)}
        <button
          type="button"
          className={styles.fabSlot}
          onClick={openAdd}
          aria-label="Log food"
        >
          <span className={styles.fab} aria-hidden="true">
            +
          </span>
          <span className={styles.tabLabel}>Log</span>
        </button>
        {RIGHT.map(tab)}
      </nav>

      {/* Desktop parity: a floating FAB (the bar above is hidden ≥ wide). */}
      <button
        type="button"
        className={styles.desktopFab}
        onClick={openAdd}
        aria-label="Log food"
      >
        <span aria-hidden="true">+</span> Log
      </button>
    </>
  );
}
