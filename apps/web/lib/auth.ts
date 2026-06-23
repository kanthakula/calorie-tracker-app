'use client';

// Token + current-user storage and a small auth context/hook.
//
// The JWT is persisted in localStorage. We intentionally keep this dependency-free:
// a tiny pub/sub keeps multiple components (header, pages) in sync, and a React
// context exposes the current user + login/logout helpers.
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { PublicUser } from '@k21/validation';

const TOKEN_KEY = 'k21.token';
const USER_KEY = 'k21.user';

// --- Low-level token storage (usable outside React, e.g. in the API client) ---

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — ignore */
  }
}

function getStoredUser(): PublicUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as PublicUser) : null;
  } catch {
    return null;
  }
}

function setStoredUser(user: PublicUser | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Clear all auth state and bounce to /login. Called by the API client on a 401.
 * Uses a hard redirect so any in-flight client state is discarded.
 */
export function clearAuthAndRedirect(): void {
  setToken(null);
  setStoredUser(null);
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

// --- React context ---

interface AuthContextValue {
  user: PublicUser | null;
  token: string | null;
  ready: boolean;
  signIn: (user: PublicUser, token: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
    setTokenState(getToken());
    setReady(true);
  }, []);

  const signIn = useCallback((nextUser: PublicUser, nextToken: string) => {
    setToken(nextToken);
    setStoredUser(nextUser);
    setTokenState(nextToken);
    setUser(nextUser);
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setStoredUser(null);
    setTokenState(null);
    setUser(null);
    if (typeof window !== 'undefined') window.location.assign('/login');
  }, []);

  // createElement (not JSX) so this file stays .ts and avoids a stray .tsx.
  return createElement(
    AuthContext.Provider,
    { value: { user, token, ready, signIn, signOut } },
    children,
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
