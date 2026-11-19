import { useCallback, useState } from 'react';

// v2's built-in pills (filter-bar-layout.ts:3-10 BUILT_IN_PILL_IDS) in its order, without featured and brands,
// which have no chip here. Stored as the ids switched off, so a device with nothing saved shows every pill
// (v2's DEFAULT_FILTER_BAR). Kept next to the quick filters' own key.
export const FILTER_BAR_PILLS_KEY = 'tallywoo.filter_bar_pills.v1';
export const BUILT_IN_PILL_IDS = ['stock_status', 'on_sale', 'categories', 'tags'] as const;
export type BuiltInPillId = (typeof BUILT_IN_PILL_IDS)[number];
/** v2's getUILabel('pos-products', id) (use-ui-label.ts; core en.json common.*). */
export const BUILT_IN_PILL_LABELS: Record<BuiltInPillId, string> = {
  stock_status: 'Stock Status', on_sale: 'On Sale', categories: 'Categories', tags: 'Tags',
};

export function loadHiddenPills(storage?: Storage): BuiltInPillId[] {
  try {
    const raw: unknown = JSON.parse((storage ?? globalThis.localStorage).getItem(FILTER_BAR_PILLS_KEY) ?? '[]');
    return Array.isArray(raw) ? BUILT_IN_PILL_IDS.filter(id => raw.includes(id)) : [];
  } catch { return []; }
}

export function saveHiddenPills(ids: readonly BuiltInPillId[], storage?: Storage): void {
  try {
    (storage ?? globalThis.localStorage).setItem(FILTER_BAR_PILLS_KEY, JSON.stringify(ids));
  } catch {}
}

export function useHiddenPills(): [BuiltInPillId[], (next: BuiltInPillId[]) => void] {
  const [state, setState] = useState(() => loadHiddenPills());
  const update = useCallback((next: BuiltInPillId[]) => {
    saveHiddenPills(next);
    setState(next);
  }, []);
  return [state, update];
}
