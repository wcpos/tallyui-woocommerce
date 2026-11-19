// An area's column switches (v2's DisplayOptions, WCPOS monorepo `screens/main/components/display-options.tsx`):
// which of the area's columns show, kept per area in localStorage as `{ id, visible }` rows, like the catalogue's
// columns in `catalogue/catalogue-view-state.ts`. Reordering is not offered, so the rows keep the area's order.
import { useCallback, useState } from 'react';

/** v2's DisplayOptions ids: the areas whose bar carries the settings icon. */
export type AreaId = 'orders' | 'customers' | 'products' | 'coupons';
/** One of a column's display lines (v2's `display` keys, `initial-settings.json`), e.g. the Product column's SKU. */
export interface AreaDisplaySetting { id: string; visible: boolean }
export interface AreaColumnSetting<Id extends string = string> { id: Id; visible: boolean; display?: AreaDisplaySetting[] }
/** One column of an area, its v2 label and its v2 default (`initial-settings.json`'s `show`), and its display lines. */
export interface AreaColumn<Id extends string = string> extends AreaColumnSetting<Id> {
  label: string;
  display?: (AreaDisplaySetting & { label: string })[];
}

export function areaColumnsKey(area: AreaId): string {
  return `tallywoo.${area}_columns.v1`;
}

/** Columns as stored rows: `{ id, visible }`, plus `display` rows only for a column that has them, so a label never
 *  reaches storage and an area without display lines stores what it always has. */
export function areaColumnRows<Id extends string>(columns: readonly AreaColumnSetting<Id>[]): AreaColumnSetting<Id>[] {
  return columns.map(({ id, visible, display }) => display
    ? { id, visible, display: display.map(line => ({ id: line.id, visible: line.visible })) } : { id, visible });
}

/** The stored row with `id` in `rows`, when `rows` is an array and holds one. */
const storedRow = (rows: unknown, id: string): { visible?: unknown; display?: unknown } | undefined => Array.isArray(rows)
  ? rows.find(item => typeof item === 'object' && item !== null && (item as { id?: unknown }).id === id) : undefined;
const storedVisible = (row: { visible?: unknown } | undefined, fallback: boolean): boolean =>
  typeof row?.visible === 'boolean' ? row.visible : fallback;

/** Reads stored rows against the area's defaults: an id the area does not know is dropped, a missing or
 *  malformed one takes its default, and the rows come back in the defaults' order; display lines likewise. */
export function normalizeAreaColumns<Id extends string>(raw: unknown, defaults: readonly AreaColumnSetting<Id>[]): AreaColumnSetting<Id>[] {
  if (!Array.isArray(raw)) return areaColumnRows(defaults);
  return defaults.map(({ id, visible, display }) => {
    const entry = storedRow(raw, id);
    const row = { id, visible: storedVisible(entry, visible) };
    return !display ? row
      : { ...row, display: display.map(line => ({ id: line.id, visible: storedVisible(storedRow(entry?.display, line.id), line.visible) })) };
  });
}

/** Whether a column is shown with its display line `key` on (v2's name cell `show(key)`). */
export function areaDisplayShown(settings: readonly AreaColumnSetting[], columnId: string, key: string): boolean {
  const setting = settings.find(row => row.id === columnId);
  return setting?.visible === true && setting.display?.some(line => line.id === key && line.visible) === true;
}

/** The columns whose setting is visible, in the columns' own order; a column with no setting is hidden. */
export function visibleAreaColumns<C extends { id: string }>(columns: readonly C[], settings: readonly AreaColumnSetting[]): C[] {
  return columns.filter(column => settings.some(setting => setting.id === column.id && setting.visible));
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
