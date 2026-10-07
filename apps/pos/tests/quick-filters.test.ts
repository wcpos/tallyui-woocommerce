import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ProductSort } from '@tallyui/pos';
import type { QuickFilter } from '../lib/catalogue/quick-filters';
import {
  QUICK_FILTERS_KEY, describeQuickFilter, isQuickFilterActive, isQuickFilterValid,
  loadQuickFilters, matchesCatalogueFilters, normalizeQuickFilters, quickFilterToQueryPatch,
  saveQuickFilters, useQuickFilters,
} from '../lib/catalogue/quick-filters';

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => Array.from(data.keys())[index] ?? null,
    removeItem: key => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
}

function qf(partial: Partial<QuickFilter> = {}): QuickFilter {
  return { id: 'a', type: 'quick', label: 'A', conditions: [{ field: 'on_sale', value: true }], ...partial };
}

test.each<[string, QuickFilter]>([
  ['a label plus one complete condition', qf()],
  ['a sort only', qf({ conditions: [], sort: { field: 'name', dir: 'asc' } })],
  ['a price with min only', qf({ conditions: [{ field: 'price', value: { min: 5 } }] })],
  ['a price with max only', qf({ conditions: [{ field: 'price', value: { max: 10 } }] })],
  ['a price with min equal to max', qf({ conditions: [{ field: 'price', value: { min: 10, max: 10 } }] })],
])('valid: %s', (_name, quickFilter) => {
  expect(isQuickFilterValid(quickFilter)).toBe(true);
});

test.each<[string, QuickFilter]>([
  ['a blank label', qf({ label: '  ' })],
  ['no conditions and no sort', qf({ conditions: [] })],
  ['empty categories', qf({ conditions: [{ field: 'categories', value: [] }] })],
  ['tags containing NaN', qf({ conditions: [{ field: 'tags', value: [NaN] }] })],
  ['a blank search', qf({ conditions: [{ field: 'search', value: '  ' }] })],
  ['a price with no bound', qf({ conditions: [{ field: 'price', value: {} }] })],
  ['a price with min greater than max', qf({ conditions: [{ field: 'price', value: { min: 11, max: 10 } }] })],
  ['an infinite price max', qf({ conditions: [{ field: 'price', value: { max: Infinity } }] })],
])('invalid: %s', (_name, quickFilter) => {
  expect(isQuickFilterValid(quickFilter)).toBe(false);
});

test('normalise: a non-array gives no quick filters', () => {
  for (const raw of [null, {}, 'x']) expect(normalizeQuickFilters(raw)).toEqual([]);
});

test('normalise drops malformed and invalid entries and keeps order', () => {
  const first = qf({ id: 'b' });
  const second = qf({ id: 'a', conditions: [{ field: 'tags', value: [2] }] });
  expect(normalizeQuickFilters([
    first,
    { ...qf(), type: 'pill' },
    { ...qf(), conditions: [{ field: 'featured', value: true }] },
    { ...qf(), conditions: [{ field: 'stock_status', value: 'lowstock' }] },
    { ...qf(), sort: { field: 'total_sales', dir: 'asc' } },
    qf({ label: '  ' }), 7, second,
  ])).toEqual([first, second]);
  expect(normalizeQuickFilters([
    null, [], new Date(), { ...qf(), id: '' }, { ...qf(), label: 7 },
    { ...qf(), conditions: {} }, { ...qf(), conditions: [null] },
    { ...qf(), conditions: [{ field: 'brands', value: [1] }] },
    { ...qf(), conditions: [{ field: 'categories', value: ['1'] }] },
    { ...qf(), conditions: [{ field: 'tags', value: 1 }] },
    { ...qf(), conditions: [{ field: 'search', value: 1 }] },
    { ...qf(), conditions: [{ field: 'on_sale', value: 'true' }] },
    { ...qf(), conditions: [{ field: 'type', value: 'variation' }] },
    { ...qf(), conditions: [{ field: 'price', value: null }] },
    { ...qf(), conditions: [{ field: 'price', value: { min: '5' } }] },
    { ...qf(), conditions: [{ field: 'price', value: { max: undefined } }] },
    qf({ conditions: [{ field: 'price', value: { min: NaN } }] }),
    qf({ conditions: [{ field: 'categories', value: [Infinity] }] }),
    { ...qf(), sort: null }, { ...qf(), sort: { field: 'name', dir: 'up' } },
  ])).toEqual([]);
});

test('normalise keeps the first of a duplicate id', () => {
  const first = qf({ label: 'First' });
  expect(normalizeQuickFilters([qf({ label: '' }), first, qf({ label: 'Later' })])).toEqual([first]);
});

test('normalise strips unknown keys', () => {
  const raw = {
    id: 'a', type: 'quick', label: 'A', extra: true,
    conditions: [
      { field: 'price', value: { min: 5, max: 10, extra: true }, extra: true },
      { field: 'categories', value: [1, 2], extra: true },
    ],
    sort: { field: 'price', dir: 'desc', extra: true },
  };
  const normalized = normalizeQuickFilters([raw]);
  expect(normalized).toEqual([{
    id: 'a', type: 'quick', label: 'A',
    conditions: [{ field: 'price', value: { min: 5, max: 10 } }, { field: 'categories', value: [1, 2] }],
    sort: { field: 'price', dir: 'desc' },
  }]);
  expect(normalized[0]).not.toBe(raw);
  expect(normalized[0].conditions).not.toBe(raw.conditions);
  expect(normalized[0].sort).not.toBe(raw.sort);
  raw.conditions.forEach((condition, index) => {
    expect(normalized[0].conditions[index]).not.toBe(condition);
    expect(normalized[0].conditions[index].value).not.toBe(condition.value);
  });
  expect(normalizeQuickFilters([qf()])[0]).not.toHaveProperty('sort');
});

test('empty or broken storage loads no quick filters', () => {
  const storage = memoryStorage();
  expect(loadQuickFilters(storage)).toEqual([]);
  for (const raw of ['not json', '{"a":1}', '[{"id":"a"}]']) {
    storage.setItem(QUICK_FILTERS_KEY, raw);
    expect(loadQuickFilters(storage)).toEqual([]);
  }
  const broken = { ...storage, getItem: () => { throw new Error('unavailable'); } };
  expect(loadQuickFilters(broken)).toEqual([]);
});

test('saves the exact JSON and loads it back', () => {
  const storage = memoryStorage();
  const filters = [qf(), qf({ id: 'b', conditions: [], sort: { field: 'sku', dir: 'asc' } })];
  saveQuickFilters(filters, storage);
  expect(storage.getItem(QUICK_FILTERS_KEY)).toBe(JSON.stringify(filters));
  expect(loadQuickFilters(storage)).toEqual(filters);
  const broken = { ...storage, setItem: () => { throw new Error('unavailable'); } };
  expect(() => saveQuickFilters(filters, broken)).not.toThrow();
});

test('useQuickFilters saves and updates', () => {
  const initial = [qf()];
  saveQuickFilters(initial);
  const { result } = renderHook(() => useQuickFilters());
  expect(result.current[0]).toEqual(initial);
  const next = [qf({ id: 'b', label: 'B' })];
  act(() => result.current[1](next));
  expect(result.current[0]).toEqual(next);
  expect(localStorage.getItem(QUICK_FILTERS_KEY)).toBe(JSON.stringify(next));
});

test('the patch puts search apart from the filters', () => {
  expect(quickFilterToQueryPatch(qf({ conditions: [
    { field: 'categories', value: [1] }, { field: 'tags', value: [2] },
    { field: 'search', value: 'old' }, { field: 'price', value: { min: 5 } },
    { field: 'on_sale', value: false }, { field: 'stock_status', value: 'instock' },
    { field: 'type', value: 'variable' }, { field: 'search', value: 'red' },
    { field: 'categories', value: [3] },
  ] }))).toEqual({
    filters: { categories: [3], tags: [2], price: { min: 5 }, on_sale: false, stock_status: 'instock', type: 'variable' },
    search: 'red',
  });
  expect(quickFilterToQueryPatch(qf({ conditions: [] }))).toEqual({ filters: {}, search: '' });
});

test('categories and tags match any listed id', () => {
  const doc = { categories: [{ id: 3 }], tags: [{ id: 8 }] };
  expect(matchesCatalogueFilters(doc, { categories: [1, 3], tags: [8, 9] })).toBe(true);
  expect(matchesCatalogueFilters(doc, { categories: [1], tags: [8] })).toBe(false);
  expect(matchesCatalogueFilters(doc, { categories: [3], tags: [9] })).toBe(false);
  expect(matchesCatalogueFilters({}, { categories: [3] })).toBe(false);
  expect(matchesCatalogueFilters({}, { tags: [8] })).toBe(false);
});

test('price bounds are inclusive and a blank price never matches a bound', () => {
  expect(matchesCatalogueFilters({ price: '10' }, { price: { min: 10 } })).toBe(true);
  expect(matchesCatalogueFilters({ price: '10' }, { price: { max: 10 } })).toBe(true);
  expect(matchesCatalogueFilters({ price: '10' }, { price: { min: 10, max: 10 } })).toBe(true);
  expect(matchesCatalogueFilters({ price: '9.99' }, { price: { min: 10 } })).toBe(false);
  expect(matchesCatalogueFilters({ price: '10.01' }, { price: { max: 10 } })).toBe(false);
  expect(matchesCatalogueFilters({ price: '' }, { price: { max: 100 } })).toBe(false);
  expect(matchesCatalogueFilters({ price: '' }, { price: {} })).toBe(true);
});

test('on sale, stock status and type match exactly', () => {
  const doc = { on_sale: true, stock_status: 'onbackorder', type: 'variable' };
  expect(matchesCatalogueFilters(doc, { on_sale: true, stock_status: 'onbackorder', type: 'variable' })).toBe(true);
  expect(matchesCatalogueFilters(doc, { on_sale: false })).toBe(false);
  expect(matchesCatalogueFilters(doc, { stock_status: 'instock' })).toBe(false);
  expect(matchesCatalogueFilters(doc, { type: 'simple' })).toBe(false);
  expect(matchesCatalogueFilters({}, { on_sale: false, type: 'simple' })).toBe(true);
  expect(matchesCatalogueFilters({}, { on_sale: true })).toBe(false);
  expect(matchesCatalogueFilters({}, { type: 'variable' })).toBe(false);
  expect(matchesCatalogueFilters({ stock_status: 'lowstock' }, { stock_status: 'instock' })).toBe(false);
});

test('empty filters match every product', () => {
  expect(matchesCatalogueFilters({}, {})).toBe(true);
  expect(matchesCatalogueFilters({ price: '', stock_status: 'lowstock' }, {})).toBe(true);
});

test('a quick filter is active only with its complete state', () => {
  const sort = { field: 'price', dir: 'desc' } as const;
  const baselineSort: ProductSort = { field: 'name', dir: 'asc' };
  const quickFilter = qf({ conditions: [{ field: 'categories', value: [3, 1] }, { field: 'search', value: 'red' }], sort });
  const state = { filters: { categories: [1, 3] }, search: 'red', sort };
  expect(isQuickFilterActive(quickFilter, state, baselineSort)).toBe(true);
  expect(isQuickFilterActive(quickFilter, { ...state, filters: { ...state.filters, on_sale: true } }, baselineSort)).toBe(false);
  expect(isQuickFilterActive(quickFilter, { ...state, search: 'blue' }, baselineSort)).toBe(false);
  expect(isQuickFilterActive(quickFilter, { ...state, sort: baselineSort }, baselineSort)).toBe(false);
  expect(isQuickFilterActive(quickFilter, { ...state, filters: { categories: [1] } }, baselineSort)).toBe(false);
  expect(isQuickFilterActive(quickFilter, { ...state, filters: { categories: [1, 2] } }, baselineSort)).toBe(false);
  expect(isQuickFilterActive(quickFilter, { ...state, sort: { field: 'price', dir: 'asc' } }, baselineSort)).toBe(false);
  const priceFilter = qf({ conditions: [{ field: 'price', value: { min: 5, max: 10 } }, { field: 'on_sale', value: false }] });
  const priceState = { filters: { price: { min: 5, max: 10 }, on_sale: false }, search: '', sort: null };
  expect(isQuickFilterActive(priceFilter, priceState, null)).toBe(true);
  expect(isQuickFilterActive(priceFilter, { ...priceState, filters: { price: { min: 5 }, on_sale: false } }, null)).toBe(false);
  expect(isQuickFilterActive(priceFilter, { ...priceState, filters: { price: { min: 6, max: 10 }, on_sale: false } }, null)).toBe(false);
  expect(isQuickFilterActive(priceFilter, { ...priceState, filters: { ...priceState.filters, on_sale: true } }, null)).toBe(false);
});

test('a quick filter without a sort expects the baseline sort', () => {
  const quickFilter = qf();
  const baselineSort: ProductSort = { field: 'name', dir: 'asc' };
  const state = { filters: { on_sale: true }, search: '', sort: baselineSort };
  expect(isQuickFilterActive(quickFilter, state, baselineSort)).toBe(true);
  expect(isQuickFilterActive(quickFilter, { ...state, sort: { field: 'price', dir: 'desc' } }, baselineSort)).toBe(false);
  expect(isQuickFilterActive(quickFilter, { ...state, sort: null }, null)).toBe(true);
  expect(isQuickFilterActive(quickFilter, { ...state, sort: null }, baselineSort)).toBe(false);
  expect(isQuickFilterActive(quickFilter, state, null)).toBe(false);
});

test('a stray undefined filter key does not break the active check', () => {
  expect(isQuickFilterActive(qf(), { filters: { on_sale: true, tags: undefined }, search: '', sort: null }, null)).toBe(true);
});

test('describes conditions and sort like v2', () => {
  const formatPrice = (value: number) => '$' + value.toFixed(2);
  expect(describeQuickFilter(qf({ conditions: [
    { field: 'categories', value: [1, 2] }, { field: 'price', value: { min: 5 } }, { field: 'on_sale', value: false },
  ], sort: { field: 'stock', dir: 'desc' } }), formatPrice))
    .toBe('Category: 2 selected · Price $5.00+ · Not on sale · Sort: Stock Quantity ↓');
  expect(describeQuickFilter(qf({ conditions: [
    { field: 'tags', value: [1] }, { field: 'on_sale', value: true }, { field: 'search', value: 'red' },
    { field: 'stock_status', value: 'instock' }, { field: 'stock_status', value: 'outofstock' },
    { field: 'stock_status', value: 'onbackorder' }, { field: 'type', value: 'simple' },
    { field: 'type', value: 'variable' }, { field: 'type', value: 'grouped' }, { field: 'type', value: 'external' },
  ] }), formatPrice)).toBe('Tag: 1 selected · On Sale · Search: red · In Stock · Out of Stock · On Backorder · Simple · Variable · Grouped · External');
  const labels = { name: 'Name', sku: 'SKU', barcode: 'Barcode', price: 'Price', stock: 'Stock Quantity' } as const;
  for (const field of ['name', 'sku', 'barcode', 'price', 'stock'] as const) {
    expect(describeQuickFilter(qf({ conditions: [], sort: { field, dir: 'asc' } }), formatPrice)).toBe(`Sort: ${labels[field]} ↑`);
  }
});

test('describes a price range and a price ceiling', () => {
  const formatPrice = (value: number) => '$' + value.toFixed(2);
  expect(describeQuickFilter(qf({ conditions: [{ field: 'price', value: { min: 5, max: 10 } }] }), formatPrice)).toBe('Price $5.00–$10.00');
  expect(describeQuickFilter(qf({ conditions: [{ field: 'price', value: { max: 10 } }] }), formatPrice)).toBe('Price up to $10.00');
});
