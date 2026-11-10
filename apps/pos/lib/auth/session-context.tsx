import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { buildAuthUrl, LoginError, newState, parseCallback } from './login';
import { discoverSite } from './site';
import type { ConnectStage } from './site';
import { clearSession, loadCashiers, loadSession, PENDING_KEY, refreshSession, saveCashiers, saveSession, SessionExpiredError } from './session';
import type { Session } from './session';
import { runBeforeLeave } from '../sale/before-leave';

interface SessionContextValue {
  session: Session | null;
  /** True while the store refused this session's refresh: it is kept, not cleared, until the cashier signs in again. */
  held: boolean;
  /** Holds the current session because the store refused this access token outside a refresh; does nothing unless it is the current token. */
  hold(accessToken: string): void;
  startReauth(): Promise<string | null>;
  cashiers: Session[];
  startAddCashier(): void;
  switchCashier(uuid: string): Promise<void>;
  removeCashier(uuid: string): void;
  ready: boolean;
  startSignIn(siteInput: string, onStage?: (stage: ConnectStage) => void): Promise<void>;
  completeSignIn(search: string): Session;
  signOut(): void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }): JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [held, setHeld] = useState(false);
  const [roster, setRoster] = useState<Record<string, Session[]>>({});
  const [ready, setReady] = useState(false);
  const current = useRef<Session | null>(null);
  const updateSession = useCallback((next: Session | null) => {
    current.current = next;
    setSession(next);
    setHeld(false);
  }, []);
  const hold = useCallback((accessToken: string) => {
    if (current.current?.tokens.accessToken === accessToken) setHeld(true);
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
        // A token not yet near expiry comes back unchanged; updating would clear a hold the store set outside a refresh.
        if (next === previous) return;
        if (mounted && current.current === previous) {
          saveSession(next);
          updateSession(next);
        }
      } catch (error) {
        // An expired session is held, not cleared: the order outbox is keyed by it, so unsent sales stay queued until the cashier signs in again (v2 session-hold-banner).
        if (mounted && current.current === previous && error instanceof SessionExpiredError) {
          setHeld(true);
        }
      }
    }
    void refresh().then(() => { if (mounted) setReady(true); });
    const interval = setInterval(() => { void refresh(); }, 5 * 60 * 1000);
    return () => { mounted = false; clearInterval(interval); };
  }, [updateSession]);

  async function startSignIn(siteInput: string, onStage?: (stage: ConnectStage) => void): Promise<void> {
    const site = await discoverSite(siteInput, undefined, onStage);
    const state = newState();
    onStage?.('saving');
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

  async function startReauth(): Promise<string | null> {
    const active = current.current;
    if (!active) return null;
    const refusal = await runBeforeLeave();
    if (refusal !== null) return refusal;
    const state = newState();
    try {
      globalThis.sessionStorage.setItem(PENDING_KEY, JSON.stringify({ state, site: active.site, mode: 'reauth' }));
    } catch {}
    window.location.assign(buildAuthUrl(active.site.authUrl, `${window.location.origin}/auth/callback`, state));
    return null;
  }

  const completeSignIn = useCallback((search: string): Session => {
    let pending;
    try {
      pending = JSON.parse(globalThis.sessionStorage.getItem(PENDING_KEY) ?? 'null');
    } catch {}
    if (!pending) throw new LoginError('no_pending', 'No sign-in is pending. Try again.');
    const next = { site: pending.site, tokens: parseCallback(search, pending.state) };
    const active = current.current ?? loadSession();
    const add = pending.mode === 'add' && active && active.site.home === next.site.home && active.tokens.user.uuid !== next.tokens.user.uuid;
    // A re-auth that comes back as someone else keeps the held cashier as another cashier, so their queued sales stay reachable.
    const kept = pending.mode === 'reauth' && active && active.site.home === next.site.home
      && active.tokens.user.uuid !== next.tokens.user.uuid ? active : undefined;
    if (!add) {
      saveSession(next);
      updateSession(next);
    }
    {
      const entries = loadCashiers();
      const others = entries[next.site.home] ?? [];
      const index = others.findIndex(entry => entry.tokens.user.uuid === next.tokens.user.uuid);
      const updated = { ...entries, [next.site.home]: add
        ? index === -1 ? [...others, next] : others.map((entry, i) => i === index ? next : entry)
        : [...others.filter(entry => entry.tokens.user.uuid !== next.tokens.user.uuid
          && entry.tokens.user.uuid !== kept?.tokens.user.uuid), ...(kept ? [kept] : [])] };
      saveCashiers(updated);
      setRoster(updated);
    }
    try { globalThis.sessionStorage.removeItem(PENDING_KEY); } catch {}
    return next;
  }, [updateSession]);

  async function switchCashier(uuid: string): Promise<void> {
    const active = current.current;
    const target = active && (loadCashiers()[active.site.home] ?? []).find(entry => entry.tokens.user.uuid === uuid);
    if (!target) throw new Error('No such cashier');
    let next;
    try {
      next = await refreshSession(target);
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        {
          const entries = loadCashiers();
          const updated = { ...entries, [target.site.home]: (entries[target.site.home] ?? []).filter(entry => entry.tokens.user.uuid !== uuid) };
          saveCashiers(updated);
          setRoster(updated);
        }
      }
      throw error;
    }
    const previous = current.current;
    saveSession(next);
    updateSession(next);
    {
      const entries = loadCashiers();
      const others = (entries[target.site.home] ?? []).filter(entry => entry.tokens.user.uuid !== uuid);
      const updated = { ...entries, [target.site.home]: previous ? [...others, previous] : others };
      saveCashiers(updated);
      setRoster(updated);
    }
  }

  function removeCashier(uuid: string): void {
    const active = current.current;
    if (!active || uuid === active.tokens.user.uuid) return;
    const home = active.site.home;
    const entries = loadCashiers();
    const updated = { ...entries, [home]: (entries[home] ?? []).filter(entry => entry.tokens.user.uuid !== uuid) };
    saveCashiers(updated);
    setRoster(updated);
  }

  function signOut(): void {
    clearSession();
    updateSession(null);
  }

  const cashiers = session ? (roster[session.site.home] ?? []).filter(entry => entry.tokens.user.uuid !== session.tokens.user.uuid) : [];
  return (
    <SessionContext.Provider value={{ session, held, hold, ready, cashiers, startSignIn, startAddCashier, startReauth, switchCashier, removeCashier, completeSignIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext)!;
}
