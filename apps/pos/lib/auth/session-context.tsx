import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { buildAuthUrl, LoginError, newState, parseCallback } from './login';
import { discoverSite } from './site';
import { clearSession, loadCashiers, loadSession, PENDING_KEY, refreshSession, saveCashiers, saveSession, SessionExpiredError } from './session';
import type { Session } from './session';

interface SessionContextValue {
  session: Session | null;
  cashiers: Session[];
  startAddCashier(): void;
  switchCashier(uuid: string): Promise<void>;
  ready: boolean;
  startSignIn(siteInput: string): Promise<void>;
  completeSignIn(search: string): Session;
  signOut(): void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }): JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [roster, setRoster] = useState<Record<string, Session[]>>({});
  const [ready, setReady] = useState(false);
  const current = useRef<Session | null>(null);
  const updateSession = useCallback((next: Session | null) => {
    current.current = next;
    setSession(next);
  }, []);

  useEffect(() => {
    let mounted = true;
    updateSession(current.current ?? loadSession());
    setRoster(loadCashiers());
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

  function startAddCashier(): void {
    const active = current.current;
    if (!active) return;
    const site = active.site;
    const state = newState();
    try {
      globalThis.sessionStorage.setItem(PENDING_KEY, JSON.stringify({ state, site, mode: 'add' }));
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
    const active = current.current;
    const add = pending.mode === 'add' && active && active.site.home === next.site.home && active.tokens.user.uuid !== next.tokens.user.uuid;
    if (!add) {
      saveSession(next);
      updateSession(next);
    }
    setRoster(entries => {
      const others = entries[next.site.home] ?? [];
      const index = others.findIndex(entry => entry.tokens.user.uuid === next.tokens.user.uuid);
      const updated = { ...entries, [next.site.home]: add
        ? index === -1 ? [...others, next] : others.map((entry, i) => i === index ? next : entry)
        : others.filter(entry => entry.tokens.user.uuid !== next.tokens.user.uuid) };
      saveCashiers(updated);
      return updated;
    });
    try { globalThis.sessionStorage.removeItem(PENDING_KEY); } catch {}
    return next;
  }, [updateSession]);

  async function switchCashier(uuid: string): Promise<void> {
    const active = current.current;
    const target = active && (roster[active.site.home] ?? []).find(entry => entry.tokens.user.uuid === uuid);
    if (!target) throw new Error('No such cashier');
    let next;
    try {
      next = await refreshSession(target);
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        setRoster(entries => {
          const updated = { ...entries, [target.site.home]: (entries[target.site.home] ?? []).filter(entry => entry.tokens.user.uuid !== uuid) };
          saveCashiers(updated);
          return updated;
        });
      }
      throw error;
    }
    const previous = current.current;
    saveSession(next);
    updateSession(next);
    setRoster(entries => {
      const others = (entries[target.site.home] ?? []).filter(entry => entry.tokens.user.uuid !== uuid);
      const updated = { ...entries, [target.site.home]: previous ? [...others, previous] : others };
      saveCashiers(updated);
      return updated;
    });
  }

  function signOut(): void {
    clearSession();
    updateSession(null);
  }

  const cashiers = session ? (roster[session.site.home] ?? []).filter(entry => entry.tokens.user.uuid !== session.tokens.user.uuid) : [];
  return (
    <SessionContext.Provider value={{ session, ready, cashiers, startSignIn, startAddCashier, switchCashier, completeSignIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext)!;
}
