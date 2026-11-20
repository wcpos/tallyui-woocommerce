import { useCallback, useState } from 'react';
import { BUILT_IN_PILL_IDS } from './filter-bar-pills';

export const FILTER_BAR_ORDER_KEY = 'tallywoo.filter_bar_order.v1';

// v2 filter-bar-layout.ts:85-110: keep saved order, then append missing built-ins and quick filters.
export function normalizeFilterBarOrder(saved: unknown, quickFilterIds: readonly string[]): string[] {
  const valid = new Set<string>([...BUILT_IN_PILL_IDS, ...quickFilterIds]);
  const entries = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string' && valid.has(id)) : [];
  return [...new Set([...entries, ...BUILT_IN_PILL_IDS, ...quickFilterIds])];
}

export function loadFilterBarOrder(storage?: Storage): unknown {
  try {
    return JSON.parse((storage ?? globalThis.localStorage).getItem(FILTER_BAR_ORDER_KEY) ?? 'null');
  } catch { return null; }
}

export function saveFilterBarOrder(order: readonly string[], storage?: Storage): void {
  try {
    (storage ?? globalThis.localStorage).setItem(FILTER_BAR_ORDER_KEY, JSON.stringify(order));
  } catch {}
}

export function useFilterBarOrder(): [unknown, (next: string[]) => void] {
  const [state, setState] = useState<unknown>(() => loadFilterBarOrder());
  const update = useCallback((next: string[]) => {
    saveFilterBarOrder(next);
    setState(next);
  }, []);
  return [state, update];
}
