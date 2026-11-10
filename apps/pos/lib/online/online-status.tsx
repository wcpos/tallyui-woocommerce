import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useSession } from '../auth/session-context';
import { checkWebsiteReachability, PROBE_INTERVAL_MS, WEBSITE_UNAVAILABLE_CONFIRMATION_MS, WEBSITE_UNAVAILABLE_CONFIRMATION_TOLERANCE_MS } from './reachability';

export type OnlineStatus = 'offline' | 'online-website-unavailable' | 'online-website-available';
// Optimistic default, as v2's web provider: a tree without the provider (tests, previews) reads online.
export const OnlineStatusContext = createContext<{ status: OnlineStatus }>({ status: 'online-website-available' });

function browserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function OnlineStatusProvider({ wpApiUrl, children }: { wpApiUrl: string | null; children: ReactNode }): JSX.Element {
  const [status, setStatus] = useState<OnlineStatus>(() => browserOffline() ? 'offline' : 'online-website-available');
  const inProgress = useRef(false);
  const requested = useRef(false);
  const failingSince = useRef<number | null>(null);
  const check = useCallback(async () => {
    if (inProgress.current) {
      requested.current = true;
      return;
    }
    inProgress.current = true;
    try {
      do {
        requested.current = false;
        if (!wpApiUrl) {
          failingSince.current = null;
          setStatus(browserOffline() ? 'offline' : 'online-website-available');
          continue;
        }
        if (browserOffline()) setStatus('offline');
        const reachable = await checkWebsiteReachability(wpApiUrl);
        if (reachable) {
          failingSince.current = null;
          setStatus('online-website-available');
        } else if (browserOffline()) {
          failingSince.current = null;
          setStatus('offline');
        } else {
          const now = Date.now();
          if (failingSince.current === null || failingSince.current > now) failingSince.current = now;
          if (now - failingSince.current >= WEBSITE_UNAVAILABLE_CONFIRMATION_MS - WEBSITE_UNAVAILABLE_CONFIRMATION_TOLERANCE_MS) {
            setStatus('online-website-unavailable');
          }
        }
      } while (requested.current);
    } finally {
      inProgress.current = false;
    }
  }, [wpApiUrl]);

  // A new store URL is a new question; the old site's failures must not confirm this one.
  useEffect(() => { failingSince.current = null; }, [wpApiUrl]);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    const online = () => { void check(); };
    const offline = () => {
      failingSince.current = null; // A dropped link is not evidence against the website.
      setStatus('offline');
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, [check]);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const visible = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', visible);
    return () => { document.removeEventListener('visibilitychange', visible); };
  }, [check]);
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') void check();
    }, PROBE_INTERVAL_MS);
    return () => { clearInterval(interval); };
  }, [check]);
  useEffect(() => { void check(); }, [check]);

  const value = useMemo(() => ({ status }), [status]);
  return <OnlineStatusContext.Provider value={value}>{children}</OnlineStatusContext.Provider>;
}

export function SessionOnlineStatusProvider({ children }: { children: ReactNode }): JSX.Element {
  const { session } = useSession();
  // The probe asks the signed-in store's REST root (StoreSite.wpApiUrl).
  return <OnlineStatusProvider wpApiUrl={session?.site.wpApiUrl ?? null}>{children}</OnlineStatusProvider>;
}

export function useOnlineStatus(): { status: OnlineStatus } {
  return useContext(OnlineStatusContext);
}

export function useIsOnline(): boolean {
  return useOnlineStatus().status === 'online-website-available';
}
