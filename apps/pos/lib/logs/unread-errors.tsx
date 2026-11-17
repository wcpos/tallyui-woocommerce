import { createContext, useContext, useEffect, useState, type JSX, type ReactNode } from 'react';
import { useSession } from '../auth/session-context';
import { useCatalogue } from '../catalogue/catalogue-context';
import type { LogCollection } from './log-store';

// v2's logs-read-state.ts logs_read_v1 watermark, here per device and keyed by site home URL.
export const LOGS_LAST_VIEWED_KEY = 'tallywoo.logs_last_viewed.v1';
const listeners = new Set<() => void>();

export function loadLogsLastViewed(site: string, storage?: Storage): number | undefined {
  try {
    const mark = JSON.parse((storage ?? globalThis.localStorage).getItem(LOGS_LAST_VIEWED_KEY) ?? '{}')[site];
    return typeof mark === 'number' && Number.isFinite(mark) ? mark : undefined;
  } catch { return undefined; }
}

export function markLogsRead(site: string, now = Date.now(), storage?: Storage): void {
  try {
    let all = {};
    try { all = JSON.parse((storage ?? globalThis.localStorage).getItem(LOGS_LAST_VIEWED_KEY) ?? '{}'); } catch {}
    (storage ?? globalThis.localStorage).setItem(LOGS_LAST_VIEWED_KEY, JSON.stringify({ ...all, [site]: now }));
  } catch {}
  listeners.forEach(listener => listener());
}

export function useUnreadErrorCount(logs: LogCollection | undefined, site: string | undefined, now = Date.now): number {
  const [mark, setMark] = useState<number>();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (site && loadLogsLastViewed(site) === undefined) markLogsRead(site, now());
    const reload = () => setMark(site ? loadLogsLastViewed(site) : undefined);
    reload();
    listeners.add(reload);
    return () => { listeners.delete(reload); };
  }, [site, now]);
  useEffect(() => {
    setCount(0);
    if (!logs || !site || mark === undefined) return;
    try {
      const subscription = logs.find({ selector: { level: 'error', timestamp: { $gt: mark } } }).$.subscribe({
        next: rows => setCount(rows.length), error: () => setCount(0),
      });
      return () => subscription.unsubscribe();
    } catch { setCount(0); }
  }, [logs, site, mark]);
  return site && logs && mark !== undefined ? count : 0;
}

export const UnreadLogsCount = createContext(0);
export function useUnreadLogsCount(): number { return useContext(UnreadLogsCount); }
export function UnreadLogsProvider({ children }: { children: ReactNode }): JSX.Element {
  const { session } = useSession();
  const { catalogue } = useCatalogue();
  const count = useUnreadErrorCount(catalogue?.logs, session?.site.home);
  return <UnreadLogsCount.Provider value={count}>{children}</UnreadLogsCount.Provider>;
}
