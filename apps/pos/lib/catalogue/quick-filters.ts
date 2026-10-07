import { useCallback, useState } from 'react';
import { mintUuid } from '@tallyui/pos';
import type { ProductSort } from '@tallyui/pos';

export const QUICK_FILTERS_KEY = 'tallywoo.quick_filters.v1';
export type QuickFilterStockStatus = 'instock' | 'outofstock' | 'onbackorder';
export type QuickFilterProductType = 'simple' | 'variable' | 'grouped' | 'external';
export interface QuickFilterPriceRange { min?: number; max?: number }
export type QuickFilterCondition =
  | { field: 'categories'; value: number[] }
  | { field: 'tags'; value: number[] }
  | { field: 'price'; value: QuickFilterPriceRange }
  | { field: 'on_sale'; value: boolean }
  | { field: 'stock_status'; value: QuickFilterStockStatus }
  | { field: 'type'; value: QuickFilterProductType }
  | { field: 'search'; value: string };
export type QuickFilterConditionField = QuickFilterCondition['field'];
// v2's condition order, without brands and featured.
export const QUICK_FILTER_CONDITION_FIELDS: readonly QuickFilterConditionField[] =
  ['categories', 'tags', 'price', 'on_sale', 'stock_status', 'type', 'search'];
export type QuickFilterSortField = 'name' | 'sku' | 'barcode' | 'price' | 'stock';
export const QUICK_FILTER_SORT_FIELDS: readonly QuickFilterSortField[] = ['name', 'sku', 'barcode', 'price', 'stock'];
export interface QuickFilterSort extends ProductSort { field: QuickFilterSortField }
export interface QuickFilter {
  id: string;
  type: 'quick';
  label: string;
  conditions: QuickFilterCondition[];
  sort?: QuickFilterSort;
}
/** The catalogue's applied filters. `{}` is the baseline: no filter. */
export interface CatalogueFilters {
  categories?: number[];
  tags?: number[];
  price?: QuickFilterPriceRange;
  on_sale?: boolean;
  stock_status?: QuickFilterStockStatus;
  type?: QuickFilterProductType;
}

export function createQuickFilterId(): string { return mintUuid(); }

export function isQuickFilterValid(quickFilter: QuickFilter): boolean {
  return quickFilter.label.trim() !== '' && (quickFilter.conditions.length > 0 || quickFilter.sort !== undefined)
    && quickFilter.conditions.every(condition => {
      switch (condition.field) {
        case 'categories': case 'tags':
          return Array.isArray(condition.value) && condition.value.length > 0 && condition.value.every(Number.isFinite);
        case 'search': return condition.value.trim() !== '';
        case 'price': {
          const { min, max } = condition.value;
          return (min !== undefined || max !== undefined)
            && (min === undefined || Number.isFinite(min)) && (max === undefined || Number.isFinite(max))
            && (min === undefined || max === undefined || min <= max);
        }
        default: return true;
      }
    });
}

export function normalizeQuickFilters(raw: unknown): QuickFilter[] {
  if (!Array.isArray(raw)) return [];
  const result: QuickFilter[] = [];
  entries: for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null
      || (Object.getPrototypeOf(entry) !== Object.prototype && Object.getPrototypeOf(entry) !== null)
      || typeof entry.id !== 'string' || entry.id === '' || entry.type !== 'quick'
      || typeof entry.label !== 'string' || !Array.isArray(entry.conditions)) continue;
    const conditions: QuickFilterCondition[] = [];
    for (const condition of entry.conditions) {
      if (typeof condition !== 'object' || condition === null || Array.isArray(condition)) continue entries;
      const { field, value } = condition;
      switch (field) {
        case 'categories': case 'tags':
          if (!Array.isArray(value) || !value.every(id => typeof id === 'number')) continue entries;
          conditions.push({ field, value: [...value] });
          break;
        case 'price':
          if (typeof value !== 'object' || value === null || Array.isArray(value)
            || ('min' in value && typeof value.min !== 'number') || ('max' in value && typeof value.max !== 'number')) continue entries;
          conditions.push({ field, value: { ...('min' in value ? { min: value.min } : {}), ...('max' in value ? { max: value.max } : {}) } });
          break;
        case 'on_sale':
          if (typeof value !== 'boolean') continue entries;
          conditions.push({ field, value });
          break;
        case 'stock_status':
          if (value !== 'instock' && value !== 'outofstock' && value !== 'onbackorder') continue entries;
          conditions.push({ field, value });
          break;
        case 'type':
          if (value !== 'simple' && value !== 'variable' && value !== 'grouped' && value !== 'external') continue entries;
          conditions.push({ field, value });
          break;
        case 'search':
          if (typeof value !== 'string') continue entries;
          conditions.push({ field, value });
          break;
        default: continue entries;
      }
    }
    const quickFilter: QuickFilter = { id: entry.id, type: 'quick', label: entry.label, conditions };
    if ('sort' in entry) {
      const sort = entry.sort;
      if (typeof sort !== 'object' || sort === null || Array.isArray(sort)
        || !QUICK_FILTER_SORT_FIELDS.includes(sort.field) || (sort.dir !== 'asc' && sort.dir !== 'desc')) continue;
      quickFilter.sort = { field: sort.field, dir: sort.dir };
    }
    if (isQuickFilterValid(quickFilter) && !result.some(kept => kept.id === quickFilter.id)) result.push(quickFilter);
  }
  return result;
}

export function loadQuickFilters(storage?: Storage): QuickFilter[] {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(QUICK_FILTERS_KEY);
    return raw === null ? [] : normalizeQuickFilters(JSON.parse(raw));
  } catch { return []; }
}

export function saveQuickFilters(quickFilters: QuickFilter[], storage?: Storage): void {
  try {
    (storage ?? globalThis.localStorage).setItem(QUICK_FILTERS_KEY, JSON.stringify(quickFilters));
  } catch {}
}

export function useQuickFilters(): [QuickFilter[], (next: QuickFilter[]) => void] {
  const [state, setState] = useState(() => loadQuickFilters());
  const update = useCallback((next: QuickFilter[]) => {
    saveQuickFilters(next);
    setState(next);
  }, []);
  return [state, update];
}

export function quickFilterToQueryPatch(quickFilter: QuickFilter): { filters: CatalogueFilters; search: string } {
  const filters: CatalogueFilters = {};
  let search = '';
  for (const condition of quickFilter.conditions) {
    if (condition.field === 'search') search = condition.value;
    else Object.assign(filters, { [condition.field]: condition.value });
  }
  return { filters, search };
}

export function matchesCatalogueFilters(doc: any, filters: CatalogueFilters): boolean {
  return Object.entries(filters).every(([field, value]) => {
    switch (field) {
      case 'categories': case 'tags':
        return Array.isArray(doc[field]) && doc[field].some((item: { id: number }) => value.includes(item.id));
      case 'price': {
        const { min, max } = value;
        if (min === undefined && max === undefined) return true;
        const p = Number.parseFloat(doc.price);
        return Number.isFinite(p) && (min === undefined || p >= min) && (max === undefined || p <= max);
      }
      case 'on_sale': return (doc.on_sale === true) === value;
      case 'stock_status': return doc.stock_status === value;
      case 'type': return (doc.type ?? 'simple') === value;
      default: return true;
    }
  });
}

export function isQuickFilterActive(
  quickFilter: QuickFilter,
  state: { filters: CatalogueFilters; search: string; sort: ProductSort | null },
  baselineSort: ProductSort | null,
): boolean {
  const patch = quickFilterToQueryPatch(quickFilter);
  const expectedSort = quickFilter.sort ?? baselineSort;
  if (state.search !== patch.search) return false;
  if (state.sort === null || expectedSort === null) {
    if (state.sort !== expectedSort) return false;
  } else if (state.sort.field !== expectedSort.field || state.sort.dir !== expectedSort.dir) return false;
  if (Object.values(state.filters).filter(value => value !== undefined).length !== Object.keys(patch.filters).length) return false;
  return Object.entries(patch.filters).every(([field, expected]) => {
    const actual = state.filters[field as keyof CatalogueFilters];
    if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every(id => actual.includes(id));
    if (field === 'price') return state.filters.price !== undefined && state.filters.price.min === expected.min && state.filters.price.max === expected.max;
    return actual === expected;
  });
}

export function describeQuickFilter(quickFilter: QuickFilter, formatPrice: (value: number) => string): string {
  const parts = quickFilter.conditions.map(condition => {
    switch (condition.field) {
      case 'categories': return `Category: ${condition.value.length} selected`;
      case 'tags': return `Tag: ${condition.value.length} selected`;
      case 'on_sale': return condition.value ? 'On Sale' : 'Not on sale';
      case 'stock_status': return { instock: 'In Stock', outofstock: 'Out of Stock', onbackorder: 'On Backorder' }[condition.value];
      case 'type': return { simple: 'Simple', variable: 'Variable', grouped: 'Grouped', external: 'External' }[condition.value];
      case 'search': return `Search: ${condition.value}`;
      case 'price': {
        const { min, max } = condition.value;
        if (min !== undefined && max !== undefined) return `Price ${formatPrice(min)}–${formatPrice(max)}`;
        if (min !== undefined) return `Price ${formatPrice(min)}+`;
        return max !== undefined ? `Price up to ${formatPrice(max)}` : '';
      }
    }
  });
  if (quickFilter.sort) {
    const labels = { name: 'Name', sku: 'SKU', barcode: 'Barcode', price: 'Price', stock: 'Stock Quantity' };
    parts.push(`Sort: ${labels[quickFilter.sort.field]} ${quickFilter.sort.dir === 'asc' ? '↑' : '↓'}`);
  }
  return parts.join(' · ');
}
