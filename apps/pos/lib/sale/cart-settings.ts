import { useCallback, useState } from 'react';
import type { LineItem } from '@tallyui/pos';

// v2's pos-cart.sortLines (pos/cart/sort-lines.ts). Fees and shipping are not sorted: Cart always renders them
// after the line items.
export type LineSort = 'newest_bottom' | 'newest_top' | 'name' | 'price';
export const LINE_SORTS: readonly { id: LineSort; label: string }[] = [
  { id: 'newest_bottom', label: 'Newest at bottom' },
  { id: 'newest_top', label: 'Newest at top' },
  { id: 'name', label: 'Name' },
  { id: 'price', label: 'Price' },
];
// v2's pos-cart.openOrdersPosition (pos/cart/ui-settings-form.tsx): the open-order tab strip above or below the cart.
export type OpenOrdersPosition = 'top' | 'bottom';
export interface CartSettings { sortLines: LineSort; openOrdersPosition: OpenOrdersPosition }
// Per-device, like the catalogue view. The cart side is not here: it is the catalogue view's `position`.
export const CART_SETTINGS_KEY = 'tallywoo.cart_settings.v1';
// v2's pos-cart defaults (initial-settings.json): newest at top, open orders at the bottom.
export const CART_SETTINGS_DEFAULTS: CartSettings = { sortLines: 'newest_top', openOrdersPosition: 'bottom' };

export function normalizeLineSort(raw: unknown): LineSort {
  return LINE_SORTS.find(sort => sort.id === raw)?.id ?? 'newest_top';
}

export function loadCartSettings(storage?: Storage): CartSettings {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(CART_SETTINGS_KEY);
    if (raw === null) return CART_SETTINGS_DEFAULTS;
    const parsed = JSON.parse(raw);
    const stored = typeof parsed === 'object' && parsed !== null ? parsed : {};
    // Settings saved before openOrdersPosition existed have no field: they get the default and keep their sort.
    return {
      sortLines: normalizeLineSort(stored.sortLines),
      openOrdersPosition: stored.openOrdersPosition === 'top' ? 'top' : 'bottom',
    };
  } catch { return CART_SETTINGS_DEFAULTS; }
}

export function saveCartSettings(settings: CartSettings, storage?: Storage): void {
  try {
    (storage ?? globalThis.localStorage).setItem(CART_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

export function useCartSettings(): [CartSettings, (next: CartSettings) => void] {
  const [settings, setSettings] = useState(() => loadCartSettings());
  const update = useCallback((next: CartSettings) => {
    saveCartSettings(next);
    setSettings(next);
  }, []);
  return [settings, update];
}

export function sortCartLines<T extends Pick<LineItem, 'name' | 'unitPriceMinor'>>(lines: readonly T[], sort: LineSort): T[] {
  const indexed = lines.map((line, index) => ({ line, index }));
  indexed.sort((a, b) => {
    if (sort === 'newest_top') return b.index - a.index;
    if (sort === 'name') return a.line.name.localeCompare(b.line.name) || a.index - b.index;
    if (sort === 'price') return a.line.unitPriceMinor - b.line.unitPriceMinor || a.index - b.index;
    return a.index - b.index;
  });
  return indexed.map(({ line }) => line);
}
