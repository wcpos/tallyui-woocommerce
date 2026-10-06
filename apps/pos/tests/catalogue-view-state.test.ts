import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { CatalogueViewState } from '@tallyui/pos';
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
});

test('saves the exact JSON and round-trips a table state', () => {
  const storage = memoryStorage();
  const state: CatalogueViewState = { view: 'table', gridColumns: 6, sort: { field: 'price', dir: 'desc' }, categoryId: null };
  saveCatalogueView(state, storage);
  expect(storage.getItem(CATALOGUE_VIEW_KEY)).toBe(JSON.stringify(state));
  expect(loadCatalogueView(storage)).toEqual(state);
});

test.each(['{not json', '{"view":"list","gridColumns":99,"sort":{"field":"","dir":"up"}}'])('invalid stored value %s loads the defaults', raw => {
  const storage = memoryStorage();
  storage.setItem(CATALOGUE_VIEW_KEY, raw);
  expect(loadCatalogueView(storage)).toEqual(CATALOGUE_VIEW_DEFAULTS);
});

test('preserves an explicit null sort and table view', () => {
  const storage = memoryStorage();
  storage.setItem(CATALOGUE_VIEW_KEY, '{"sort":null,"view":"table"}');
  expect(loadCatalogueView(storage)).toEqual({ ...CATALOGUE_VIEW_DEFAULTS, view: 'table', sort: null });
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
  const next: CatalogueViewState = { ...CATALOGUE_VIEW_DEFAULTS, view: 'table' };
  act(() => result.current[1](next));
  expect(result.current[0]).toEqual(next);
});
