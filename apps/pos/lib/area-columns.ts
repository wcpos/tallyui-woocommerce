// An area's column switches (v2's DisplayOptions, WCPOS monorepo `screens/main/components/display-options.tsx`):
// which of the area's columns show, kept per area in localStorage as `{ id, visible }` rows, like the catalogue's
// columns in `catalogue/catalogue-view-state.ts`. Reordering is not offered, so the rows keep the area's order.
import { useCallback, useState } from 'react';

/** v2's DisplayOptions ids: the areas whose bar carries the settings icon. */
export type AreaId = 'orders' | 'customers' | 'products' | 'coupons';
export interface AreaColumnSetting<Id extends string = string> { id: Id; visible: boolean }
/** One column of an area, its v2 label and its v2 default (`initial-settings.json`'s `show`). */
export interface AreaColumn<Id extends string = string> extends AreaColumnSetting<Id> { label: string }

export function areaColumnsKey(area: AreaId): string {
  return `tallywoo.${area}_columns.v1`;
}

/** Columns as stored rows: `{ id, visible }` only, so a label never reaches storage. */
export function areaColumnRows<Id extends string>(columns: readonly AreaColumnSetting<Id>[]): AreaColumnSetting<Id>[] {
  return columns.map(({ id, visible }) => ({ id, visible }));
}

/** Reads stored rows against the area's defaults: an id the area does not know is dropped, a missing or
 *  malformed one takes its default, and the rows come back in the defaults' order. */
export function normalizeAreaColumns<Id extends string>(raw: unknown, defaults: readonly AreaColumnSetting<Id>[]): AreaColumnSetting<Id>[] {
  if (!Array.isArray(raw)) return areaColumnRows(defaults);
  return defaults.map(({ id, visible }) => {
    const entry: unknown = raw.find(item => typeof item === 'object' && item !== null && (item as { id?: unknown }).id === id);
    const stored = entry === undefined ? undefined : (entry as { visible?: unknown }).visible;
    return { id, visible: typeof stored === 'boolean' ? stored : visible };
  });
}

export function loadAreaColumns<Id extends string>(area: AreaId, defaults: readonly AreaColumnSetting<Id>[], storage?: Storage): AreaColumnSetting<Id>[] {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(areaColumnsKey(area));
    if (raw === null) return areaColumnRows(defaults);
    return normalizeAreaColumns(JSON.parse(raw), defaults);
  } catch { return areaColumnRows(defaults); }
}

export function saveAreaColumns<Id extends string>(area: AreaId, columns: readonly AreaColumnSetting<Id>[], storage?: Storage): void {
  try {
    (storage ?? globalThis.localStorage).setItem(areaColumnsKey(area), JSON.stringify(areaColumnRows(columns)));
  } catch {}
}

/** The area's column rows and their setter, which saves as it sets. */
export function useAreaColumns<Id extends string>(area: AreaId, defaults: readonly AreaColumnSetting<Id>[]):
  [AreaColumnSetting<Id>[], (next: readonly AreaColumnSetting<Id>[]) => void] {
  const [columns, setColumns] = useState(() => loadAreaColumns(area, defaults));
  const update = useCallback((next: readonly AreaColumnSetting<Id>[]) => {
    saveAreaColumns(area, next);
    setColumns(areaColumnRows(next));
  }, [area]);
  return [columns, update];
}
