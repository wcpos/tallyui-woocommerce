import { expect, test } from 'vitest';
import { catalogueQuery, initialCatalogueQuery } from './catalogue-query';
import type { CatalogueQuery, CatalogueQueryAction } from './catalogue-query';
import { quickFilterToQueryPatch } from './quick-filters';
import type { CatalogueFilters, QuickFilter } from './quick-filters';

const state: CatalogueQuery = {
  term: 'wool',
  filters: { categories: [3], stock_status: 'outofstock', on_sale: true },
  sortOverride: { field: 'price', dir: 'desc' },
  place: { kind: 'term', id: 7, name: 'Hats' },
};
const baseline: CatalogueFilters = { stock_status: 'instock' };
const quickFilter: QuickFilter = {
  id: 'hats', type: 'quick', label: 'Hats',
  conditions: [{ field: 'categories', value: [7] }],
  sort: { field: 'name', dir: 'asc' },
};

test('initialCatalogueQuery starts with the supplied baseline', () => {
  expect(initialCatalogueQuery(state.filters)).toEqual({ term: '', filters: state.filters, sortOverride: null, place: null });
});

test('search replaces only the term', () => {
  expect(catalogueQuery(state, { type: 'search', term: 'cotton' })).toEqual({ ...state, term: 'cotton' });
});

test('filter replaces only the filters', () => {
  expect(catalogueQuery(state, { type: 'filter', filters: baseline })).toEqual({ ...state, filters: baseline });
});

test('open replaces only the place', () => {
  expect(catalogueQuery(state, { type: 'open', place: { kind: 'all' } })).toEqual({ ...state, place: { kind: 'all' } });
  expect(catalogueQuery(state, { type: 'open', place: null })).toEqual({ ...state, place: null });
});

test('stockSettingChanged rebases only the stock filter', () => {
  expect(catalogueQuery(state, { type: 'stockSettingChanged', showOutOfStock: true })).toEqual({
    ...state, filters: { categories: [3], on_sale: true },
  });
  expect(catalogueQuery(state, { type: 'stockSettingChanged', showOutOfStock: false })).toEqual({
    ...state, filters: { ...state.filters, stock_status: 'instock' },
  });
});

test('sortSettingChanged clears only the sort override', () => {
  expect(catalogueQuery(state, { type: 'sortSettingChanged' })).toEqual({ ...state, sortOverride: null });
});

test('browseByChanged clears only the place', () => {
  expect(catalogueQuery(state, { type: 'browseByChanged' })).toEqual({ ...state, place: null });
});

test('applyQuickFilter replaces the query from the baseline and keeps the place', () => {
  const patch = quickFilterToQueryPatch(quickFilter);
  expect(catalogueQuery(state, { type: 'applyQuickFilter', quickFilter, baseline })).toEqual({
    ...state, term: patch.search, filters: { ...baseline, ...patch.filters }, sortOverride: quickFilter.sort,
  });
  expect(catalogueQuery(state, { type: 'applyQuickFilter', quickFilter: { ...quickFilter, sort: undefined }, baseline })).toEqual({
    ...state, term: patch.search, filters: { ...baseline, ...patch.filters }, sortOverride: null,
  });
});

test('clearQuickFilter restores the baseline and returns to the browse root', () => {
  expect(catalogueQuery(state, { type: 'clearQuickFilter', baseline })).toEqual({
    term: '', filters: baseline, sortOverride: null, place: null,
  });
});

test('appliedQuickFilterGone restores the baseline and keeps the place', () => {
  expect(catalogueQuery(state, { type: 'appliedQuickFilterGone', baseline })).toEqual({
    ...state, term: '', filters: baseline, sortOverride: null,
  });
});

test('every action returns a new object without mutating the state or its filters', () => {
  const before = { ...state, filters: { ...state.filters } };
  Object.freeze(state.filters);
  Object.freeze(state);
  const actions: CatalogueQueryAction[] = [
    { type: 'search', term: 'cotton' },
    { type: 'filter', filters: baseline },
    { type: 'open', place: null },
    { type: 'stockSettingChanged', showOutOfStock: true },
    { type: 'sortSettingChanged' },
    { type: 'browseByChanged' },
    { type: 'applyQuickFilter', quickFilter, baseline },
    { type: 'clearQuickFilter', baseline },
    { type: 'appliedQuickFilterGone', baseline },
  ];
  for (const action of actions) {
    expect(catalogueQuery(state, action)).not.toBe(state);
    expect(state).toEqual(before);
  }
});
