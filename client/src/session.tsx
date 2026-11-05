import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Principal } from './types';

const TOKEN_KEY = 'helio.token';

interface SessionValue {
  token: string | null;
  principal: Principal | null;
  ready: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [ready, setReady] = useState(() => sessionStorage.getItem(TOKEN_KEY) === null);

  useEffect(() => {
    if (!token) {
      setPrincipal(null);
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    api<{ data: Principal }>('/api/v1/auth/me', { token })
      .then((body) => {
        if (!cancelled) {
          setPrincipal(body.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          sessionStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setPrincipal(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const value = useMemo<SessionValue>(
    () => ({
      token,
      principal,
      ready,
      login(next) {
        sessionStorage.setItem(TOKEN_KEY, next);
        setToken(next);
      },
      logout() {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setPrincipal(null);
      },
    }),
    [token, principal, ready],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('Session is missing');
  }
  return value;
}
