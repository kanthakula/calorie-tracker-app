'use client';

// Admin-token storage. Kept separate from the user JWT. Persisted in localStorage
// so a console refresh doesn't force re-login within the token's short lifetime;
// the backend still enforces expiry. API keys are NEVER stored here.

const ADMIN_TOKEN_KEY = 'k21.adminToken';

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
