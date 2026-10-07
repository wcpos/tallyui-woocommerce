import { useCallback, useState } from 'react';
import { normalizeCatalogueViewState } from '@tallyui/pos';
import type { CatalogueViewState } from '@tallyui/pos';

export const CATALOGUE_VIEW_KEY = 'tallywoo.catalogue_view.v1';
export type CatalogueColumnId = 'name' | 'price' | 'stock' | 'category' | 'sku' | 'barcode';
export interface CatalogueColumnSetting { id: CatalogueColumnId; visible: boolean }
export type CatalogueTileFieldId = 'name' | 'price' | 'category' | 'sku' | 'barcode' | 'stock';
export type CatalogueTileFields = Record<CatalogueTileFieldId, boolean>;
export type PanelPosition = 'left' | 'right';
// WCPOS v2's pos-products.width: the products pane's share of the till in percent. Both panes keep at least 25%,
// and the resize handle's arrow keys move it 5 points.
export const PRODUCTS_WIDTH_DEFAULT = 60;
export const PRODUCTS_WIDTH_MIN = 25;
export const PRODUCTS_WIDTH_MAX = 75;
export const PRODUCTS_WIDTH_STEP = 5;
export interface AppCatalogueViewState extends CatalogueViewState { columns: CatalogueColumnSetting[]; tileFields: CatalogueTileFields; position: PanelPosition; width: number }
// Stock and categories are columns here because ProductTable has no name sub-fields.
export const CATALOGUE_COLUMNS: { id: CatalogueColumnId; label: string; visible: boolean }[] = [
  { id: 'name', label: 'Name', visible: true },
  { id: 'price', label: 'Price', visible: true },
  { id: 'stock', label: 'Stock', visible: true },
  { id: 'category', label: 'Category', visible: true },
  { id: 'sku', label: 'SKU', visible: false },
  { id: 'barcode', label: 'Barcode', visible: false },
];
// Grid tile fields in WCPOS v2's order, with v2's defaults (name and price on). v2's Tax, On Sale and Cost of
// Goods Sold fields are left out: TallyUI has no tax display, no way to hide the was-price, and no COGS trait.
export const CATALOGUE_TILE_FIELDS: { id: CatalogueTileFieldId; label: string; visible: boolean }[] = [
  { id: 'name', label: 'Name', visible: true },
  { id: 'price', label: 'Price', visible: true },
  { id: 'category', label: 'Category', visible: false },
  { id: 'sku', label: 'SKU', visible: false },
  { id: 'barcode', label: 'Barcode', visible: false },
  { id: 'stock', label: 'Stock', visible: false },
];
// WCPOS v2's products panel defaults: grid, 4 tiles a row, name ascending.
export const CATALOGUE_VIEW_DEFAULTS: AppCatalogueViewState = {
  view: 'grid', gridColumns: 4, sort: { field: 'name', dir: 'asc' }, categoryId: null,
  columns: CATALOGUE_COLUMNS.map(({ id, visible }) => ({ id, visible })),
  tileFields: Object.fromEntries(CATALOGUE_TILE_FIELDS.map(({ id, visible }) => [id, visible])) as CatalogueTileFields,
  // v2's pos-products.position: the side the products pane takes, with the cart on the other side.
  position: 'left',
  // v2's pos-products.width.
  width: PRODUCTS_WIDTH_DEFAULT,
};

export function normalizePanelPosition(raw: unknown): PanelPosition {
  return raw === 'right' ? 'right' : 'left';
}

export function clampProductsWidth(width: number): number {
  return Math.min(PRODUCTS_WIDTH_MAX, Math.max(PRODUCTS_WIDTH_MIN, width));
}

export function normalizeProductsWidth(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? clampProductsWidth(raw) : PRODUCTS_WIDTH_DEFAULT;
}

// Moves the handle between the panes by `delta` points (positive is rightwards). With the products on the right,
// moving the handle right narrows them.
export function moveProductsWidth(width: number, delta: number, position: PanelPosition): number {
  return clampProductsWidth(width + (position === 'right' ? -delta : delta));
}

// The products width after dragging the handle `dx` pixels across a till `groupWidth` pixels wide.
export function dragProductsWidth(start: number, dx: number, groupWidth: number, position: PanelPosition): number {
  if (!(groupWidth > 0)) return clampProductsWidth(start);
  return moveProductsWidth(start, (dx / groupWidth) * 100, position);
}

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

export function normalizeCatalogueTileFields(raw: unknown): CatalogueTileFields {
  return Object.fromEntries(CATALOGUE_TILE_FIELDS.map(({ id, visible }) => {
    const value = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>)[id] : undefined;
    return [id, typeof value === 'boolean' ? value : visible];
  })) as CatalogueTileFields;
}

export function loadCatalogueView(storage?: Storage): AppCatalogueViewState {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(CATALOGUE_VIEW_KEY);
    if (raw === null) return CATALOGUE_VIEW_DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      ...normalizeCatalogueViewState(parsed, CATALOGUE_VIEW_DEFAULTS),
      columns: normalizeCatalogueColumns(typeof parsed === 'object' && parsed !== null ? parsed.columns : undefined),
      tileFields: normalizeCatalogueTileFields(typeof parsed === 'object' && parsed !== null ? parsed.tileFields : undefined),
      position: normalizePanelPosition(typeof parsed === 'object' && parsed !== null ? parsed.position : undefined),
      width: normalizeProductsWidth(typeof parsed === 'object' && parsed !== null ? parsed.width : undefined),
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
