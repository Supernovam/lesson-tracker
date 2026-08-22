import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api/config';

export type AuthUser = {
  email: string;
  name: string;
  picture: string;
};

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

function readAuthQueryError() {
  const params = new URLSearchParams(window.location.search);
  const auth = params.get('auth');
  if (auth === 'denied') return 'That Google account is not allowed to use this app.';
  if (auth === 'error') return 'Google sign-in failed. Please try again.';
  return null;
}

function clearAuthQuery() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('auth')) return;
  url.searchParams.delete('auth');
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, '', next);
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [error, setError] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : readAuthQueryError()
  );

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const res = await apiFetch('/auth/me', { signal });
    if (res.status === 401) {
      setUser(null);
      setStatus('unauthenticated');
      return;
    }
    if (!res.ok) {
      throw new Error(`Failed to check session: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as AuthUser;
    setUser(data);
    setStatus('authenticated');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    if (readAuthQueryError()) clearAuthQuery();

    refresh(controller.signal).catch((err) => {
      const maybeName =
        err instanceof Error
          ? err.name
          : typeof err === 'object' && err !== null && 'name' in err
            ? (err as { name?: unknown }).name
            : undefined;
      if (maybeName === 'AbortError') return;
      if (!isMounted) return;
      console.error(err);
      setUser(null);
      setStatus('unauthenticated');
      setError('Could not check whether you are signed in.');
    });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [refresh]);

  const logout = useCallback(async () => {
    await apiFetch('/auth/logout', { method: 'POST' }).catch((err) => {
      console.error(err);
    });
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  return { user, status, error, logout };
}
