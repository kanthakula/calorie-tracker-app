// Auth context: persists the JWT in AsyncStorage and exposes it to the app.
//
// The API client (lib/api.ts) is framework-agnostic, so we bridge the two with
// two module-level hooks: `setTokenAccessor` lets the client read the current
// token synchronously, and `setUnauthorizedHandler` lets the client tell us to
// sign the user out when the server returns 401.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PublicUser } from '@k21/validation';
import { setTokenAccessor, setUnauthorizedHandler } from './api';

const TOKEN_KEY = 'k21.token';
const USER_KEY = 'k21.user';

interface AuthState {
  user: PublicUser | null;
  token: string | null;
  /** True until the persisted token has been loaded from storage. */
  loading: boolean;
  signIn: (token: string, user: PublicUser) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Keep the API client's view of the token in sync (synchronous read).
  useEffect(() => {
    setTokenAccessor(() => token);
  }, [token]);

  const signOut = useCallback(async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  }, []);

  const signIn = useCallback(async (newToken: string, newUser: PublicUser) => {
    setToken(newToken);
    setUser(newUser);
    await AsyncStorage.multiSet([
      [TOKEN_KEY, newToken],
      [USER_KEY, JSON.stringify(newUser)],
    ]);
  }, []);

  // Register the 401 handler once.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut();
    });
  }, [signOut]);

  // Load persisted session on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [[, storedToken], [, storedUser]] = await AsyncStorage.multiGet([
          TOKEN_KEY,
          USER_KEY,
        ]);
        if (!active) return;
        if (storedToken) setToken(storedToken);
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser) as PublicUser);
          } catch {
            // Ignore corrupt cached user; token alone is enough to stay signed in.
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, token, loading, signIn, signOut }),
    [user, token, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
