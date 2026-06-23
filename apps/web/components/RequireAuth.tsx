'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

/**
 * Client-side route guard. Waits for auth to hydrate from localStorage, then:
 *  - if no token, redirects to /login
 *  - otherwise renders children.
 * Shows a lightweight loading state while hydrating to avoid a flash.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !token) router.replace('/login');
  }, [ready, token, router]);

  if (!ready || !token) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          minHeight: '60dvh',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--text-muted)',
        }}
      >
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
