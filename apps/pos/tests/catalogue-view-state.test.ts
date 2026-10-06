import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { AppCatalogueViewState } from '../lib/catalogue/catalogue-view-state';
import { CATALOGUE_VIEW_DEFAULTS, CATALOGUE_VIEW_KEY, loadCatalogueView, saveCatalogueView, useCatalogueView } from '../lib/catalogue/catalogue-view-state';

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

test('empty storage loads the defaults', () => {
  expect(loadCatalogueView(memoryStorage())).toEqual(CATALOGUE_VIEW_DEFAULTS);
  expect(CATALOGUE_VIEW_DEFAULTS.columns).toEqual([
    { id: 'name', visible: true }, { id: 'price', visible: true },
    { id: 'stock', visible: true }, { id: 'category', visible: true },
    { id: 'sku', visible: false }, { id: 'barcode', visible: false },
  ]);
  expect(CATALOGUE_VIEW_DEFAULTS.tileFields).toEqual({ name: true, price: true, category: false, sku: false, barcode: false, stock: false });
  expect(Object.keys(CATALOGUE_VIEW_DEFAULTS.tileFields)).toEqual(['name', 'price', 'category', 'sku', 'barcode', 'stock']);
});

test('saves the exact JSON and round-trips a table state', () => {
  const storage = memoryStorage();
  const state: AppCatalogueViewState = {
    view: 'table', gridColumns: 6, sort: { field: 'price', dir: 'desc' }, categoryId: null,
    columns: CATALOGUE_VIEW_DEFAULTS.columns.map(c => ({ ...c, visible: c.id === 'sku' ? true : c.id === 'category' ? false : c.visible })),
    tileFields: { ...CATALOGUE_VIEW_DEFAULTS.tileFields, sku: true, price: false },
    position: 'right',
  };
  saveCatalogueView(state, storage);
  expect(storage.getItem(CATALOGUE_VIEW_KEY)).toBe(JSON.stringify(state));
  expect(loadCatalogueView(storage)).toEqual(state);
});

test.each(['{not json', 'null', '42', '{"view":"list","gridColumns":99,"sort":{"field":"","dir":"up"}}'])('invalid stored value %s loads the defaults', raw => {
  const storage = memoryStorage();
  storage.setItem(CATALOGUE_VIEW_KEY, raw);
  expect(loadCatalogueView(storage)).toEqual(CATALOGUE_VIEW_DEFAULTS);
});

test('preserves an explicit null sort and table view', () => {
  const storage = memoryStorage();
  storage.setItem(CATALOGUE_VIEW_KEY, '{"sort":null,"view":"table"}');
  expect(loadCatalogueView(storage)).toEqual({ ...CATALOGUE_VIEW_DEFAULTS, view: 'table', sort: null });
});

test('a stored value without position loads products left', () => {
  const storage = memoryStorage();
  storage.setItem(CATALOGUE_VIEW_KEY, '{"view":"table"}');
  expect(loadCatalogueView(storage).position).toBe('left');
});

test.each(['right', 'left', 'top', 7, null])('position %s normalises', position => {
  const storage = memoryStorage();
  storage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ position }));
  expect(loadCatalogueView(storage).position).toBe(position === 'right' ? 'right' : 'left');
});

test('ignores storage read and write errors', () => {
  const storage = memoryStorage();
  storage.getItem = () => { throw new Error('unreadable'); };
  storage.setItem = () => { throw new Error('unwritable'); };
  expect(loadCatalogueView(storage)).toEqual(CATALOGUE_VIEW_DEFAULTS);
  expect(() => saveCatalogueView(CATALOGUE_VIEW_DEFAULTS, storage)).not.toThrow();
});

test('updates in-memory state even when saving fails', () => {
  const storage = memoryStorage();
  storage.setItem = () => { throw new Error('unwritable'); };
  vi.stubGlobal('localStorage', storage);
  const { result } = renderHook(() => useCatalogueView());
  const next: AppCatalogueViewState = { ...CATALOGUE_VIEW_DEFAULTS, view: 'table' };
  act(() => result.current[1](next));
  expect(result.current[0]).toEqual(next);
});

test('normalizes stored columns in order, keeping name visible and appending missing defaults', () => {
  const storage = memoryStorage();
  storage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ columns: [
    { id: 'sku', visible: true }, { id: 'bogus', visible: true }, { id: 'name', visible: false },
    { id: 'price', visible: 'yes' }, { id: 'sku', visible: false },
  ] }));
  expect(loadCatalogueView(storage).columns).toEqual([
    { id: 'sku', visible: true }, { id: 'name', visible: true }, { id: 'price', visible: true },
    { id: 'stock', visible: true }, { id: 'category', visible: true }, { id: 'barcode', visible: false },
  ]);
});

test('invalid columns fall back independently of the stored view', () => {
  const storage = memoryStorage();
  storage.setItem(CATALOGUE_VIEW_KEY, '{"view":"table","columns":"x"}');
  const state = loadCatalogueView(storage);
  expect(state).toEqual({ ...CATALOGUE_VIEW_DEFAULTS, view: 'table' });
  expect(state.columns).not.toBe(CATALOGUE_VIEW_DEFAULTS.columns);
});

test('normalizes tile fields individually and drops unknown keys', () => {
  const storage = memoryStorage();
  storage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ tileFields: { sku: true, price: 'no', name: false, bogus: true } }));
  const fields = loadCatalogueView(storage).tileFields;
  expect(fields).toEqual({ name: false, price: true, category: false, sku: true, barcode: false, stock: false });
  expect(Object.keys(fields)).toEqual(['name', 'price', 'category', 'sku', 'barcode', 'stock']);
});

test.each(['{"view":"table","tileFields":[true]}', '{"view":"table","tileFields":"x"}'])('invalid tile fields fall back independently of the stored view: %s', raw => {
  const storage = memoryStorage();
  storage.setItem(CATALOGUE_VIEW_KEY, raw);
  const state = loadCatalogueView(storage);
  expect(state).toEqual({ ...CATALOGUE_VIEW_DEFAULTS, view: 'table' });
  expect(state.tileFields).not.toBe(CATALOGUE_VIEW_DEFAULTS.tileFields);
});
