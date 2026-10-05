import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { buildAuthUrl, LoginError, newState, parseCallback } from './login';
import { discoverSite } from './site';
import { clearSession, loadSession, PENDING_KEY, refreshSession, saveSession, SessionExpiredError } from './session';
import type { Session } from './session';

interface SessionContextValue {
  session: Session | null;
  ready: boolean;
  startSignIn(siteInput: string): Promise<void>;
  completeSignIn(search: string): Session;
  signOut(): void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }): JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const current = useRef<Session | null>(null);
  const updateSession = useCallback((next: Session | null) => {
    current.current = next;
    setSession(next);
  }, []);

  useEffect(() => {
    let mounted = true;
    updateSession(current.current ?? loadSession());
    async function refresh() {
      const previous = current.current;
      if (!previous) return;
      try {
        const next = await refreshSession(previous);
        if (mounted && current.current === previous) {
          saveSession(next);
          updateSession(next);
        }
      } catch (error) {
        if (mounted && current.current === previous && error instanceof SessionExpiredError) {
          clearSession();
          updateSession(null);
        }
      }
    }
    void refresh().then(() => { if (mounted) setReady(true); });
    const interval = setInterval(() => { void refresh(); }, 5 * 60 * 1000);
    return () => { mounted = false; clearInterval(interval); };
  }, [updateSession]);

  async function startSignIn(siteInput: string): Promise<void> {
    const site = await discoverSite(siteInput);
    const state = newState();
    try {
      globalThis.sessionStorage.setItem(PENDING_KEY, JSON.stringify({ state, site }));
    } catch {}
    window.location.assign(buildAuthUrl(site.authUrl, `${window.location.origin}/auth/callback`, state));
  }

  const completeSignIn = useCallback((search: string): Session => {
    let pending;
    try {
      pending = JSON.parse(globalThis.sessionStorage.getItem(PENDING_KEY) ?? 'null');
    } catch {}
    if (!pending) throw new LoginError('no_pending', 'No sign-in is pending. Try again.');
    const next = { site: pending.site, tokens: parseCallback(search, pending.state) };
    saveSession(next);
    try { globalThis.sessionStorage.removeItem(PENDING_KEY); } catch {}
    updateSession(next);
    return next;
  }, [updateSession]);

  function signOut(): void {
    clearSession();
    updateSession(null);
  }

  return (
    <SessionContext.Provider value={{ session, ready, startSignIn, completeSignIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext)!;
}
