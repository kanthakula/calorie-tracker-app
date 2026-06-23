'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import styles from './Section.module.css';

const STORAGE_PREFIX = 'k21:section:';

/**
 * Collapsible section with a stable anchor `id` (used by QuickNav jump links).
 * Open/closed state is remembered per-section in localStorage. Listens for a
 * `k21:expand` event so a quick-link can force-open a collapsed section before
 * scrolling to it.
 */
export function Section({
  id,
  title,
  icon,
  badge,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  icon?: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  // Restore the remembered state after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_PREFIX + id);
      if (saved != null) setOpen(saved === '1');
    } catch {
      // localStorage unavailable — keep the default.
    }
  }, [id]);

  // A quick-link can ask us to open before it scrolls here.
  useEffect(() => {
    function onExpand(e: Event) {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (detail?.id === id) setOpen(true);
    }
    window.addEventListener('k21:expand', onExpand);
    return () => window.removeEventListener('k21:expand', onExpand);
  }, [id]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_PREFIX + id, next ? '1' : '0');
      } catch {
        // Non-critical — state still toggles for this session.
      }
      return next;
    });
  }

  return (
    <section id={id} className={styles.section}>
      <button
        type="button"
        className={styles.header}
        onClick={toggle}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <span className={styles.title}>
          {icon && (
            <span className={styles.icon} aria-hidden="true">
              {icon}
            </span>
          )}
          {title}
        </span>
        <span className={styles.right}>
          {badge != null && <span className={styles.badge}>{badge}</span>}
          <span
            className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
            aria-hidden="true"
          >
            ⌄
          </span>
        </span>
      </button>
      {open && (
        <div id={bodyId} className={styles.body}>
          {children}
        </div>
      )}
    </section>
  );
}
