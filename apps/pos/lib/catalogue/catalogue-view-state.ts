import { useCallback, useState } from 'react';
import { normalizeCatalogueViewState } from '@tallyui/pos';
import type { CatalogueViewState } from '@tallyui/pos';

export const CATALOGUE_VIEW_KEY = 'tallywoo.catalogue_view.v1';
export type CatalogueColumnId = 'name' | 'price' | 'stock' | 'category' | 'sku' | 'barcode';
export interface CatalogueColumnSetting { id: CatalogueColumnId; visible: boolean }
export interface AppCatalogueViewState extends CatalogueViewState { columns: CatalogueColumnSetting[] }
// Stock and categories are columns here because ProductTable has no name sub-fields.
export const CATALOGUE_COLUMNS: { id: CatalogueColumnId; label: string; visible: boolean }[] = [
  { id: 'name', label: 'Name', visible: true },
  { id: 'price', label: 'Price', visible: true },
  { id: 'stock', label: 'Stock', visible: true },
  { id: 'category', label: 'Category', visible: true },
  { id: 'sku', label: 'SKU', visible: false },
  { id: 'barcode', label: 'Barcode', visible: false },
];
// WCPOS v2's products panel defaults: grid, 4 tiles a row, name ascending.
export const CATALOGUE_VIEW_DEFAULTS: AppCatalogueViewState = {
  view: 'grid', gridColumns: 4, sort: { field: 'name', dir: 'asc' }, categoryId: null,
  columns: CATALOGUE_COLUMNS.map(({ id, visible }) => ({ id, visible })),
};

export function normalizeCatalogueColumns(raw: unknown): CatalogueColumnSetting[] {
  if (!Array.isArray(raw)) return CATALOGUE_VIEW_DEFAULTS.columns.map(column => ({ ...column }));
  const columns: CatalogueColumnSetting[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null || typeof entry.visible !== 'boolean') continue;
    const column = CATALOGUE_COLUMNS.find(column => column.id === entry.id);
    if (!column || columns.some(kept => kept.id === column.id)) continue;
    columns.push({ id: column.id, visible: column.id === 'name' ? true : entry.visible });
  }
  for (const { id, visible } of CATALOGUE_COLUMNS) {
    if (!columns.some(column => column.id === id)) columns.push({ id, visible });
  }
  return columns;
}

export function loadCatalogueView(storage?: Storage): AppCatalogueViewState {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(CATALOGUE_VIEW_KEY);
    if (raw === null) return CATALOGUE_VIEW_DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      ...normalizeCatalogueViewState(parsed, CATALOGUE_VIEW_DEFAULTS),
      columns: normalizeCatalogueColumns(typeof parsed === 'object' && parsed !== null ? parsed.columns : undefined),
    };
  } catch { return CATALOGUE_VIEW_DEFAULTS; }
}

export function saveCatalogueView(state: AppCatalogueViewState, storage?: Storage): void {
  try {
    (storage ?? globalThis.localStorage).setItem(CATALOGUE_VIEW_KEY, JSON.stringify(state));
  } catch {}
}

export function useCatalogueView(): [AppCatalogueViewState, (next: AppCatalogueViewState) => void] {
  const [state, setState] = useState(() => loadCatalogueView());
  const update = useCallback((next: AppCatalogueViewState) => {
    saveCatalogueView(next);
    setState(next);
  }, []);
  return [state, update];
}
