import { expect, test } from 'vitest';
import { categoriesLabel, categoryTerms, filtersAtBaseline, productsInCategory, productsLabel } from '../lib/catalogue/browse-terms';
import { CATALOGUE_VIEW_DEFAULTS, CATALOGUE_VIEW_KEY, loadCatalogueView, readBrowseBy } from '../lib/catalogue/catalogue-view-state';
import { tintOf } from '../lib/catalogue/tile-words';

const coffee = { id: 25, name: 'Coffee' };
const merch = { id: 27, name: 'merch' };
const beans = { id: 31, name: 'Beans' };

test('tintOf ports v2: a number modulo six, negatives wrapped, a string by its code units', () => {
  expect(tintOf(0)).toBe(0);
  expect(tintOf(7)).toBe(1);
  expect(tintOf(-1)).toBe(5);
  expect(tintOf('ab')).toBe((97 + 98) % 6);
});

test('categoryTerms gives one term per distinct category id with its product count', () => {
  const terms = categoryTerms([
    { id: 1, categories: [coffee] },
    { id: 2, categories: [coffee] },
    { id: 3, categories: [merch] },
  ]);
  expect(terms).toEqual([{ id: 25, name: 'Coffee', count: 2 }, { id: 27, name: 'merch', count: 1 }]);
});

test('categoryTerms orders by name, ignoring case', () => {
  const terms = categoryTerms([{ id: 1, categories: [merch] }, { id: 2, categories: [coffee] }, { id: 3, categories: [beans] }]);
  expect(terms.map(term => term.name)).toEqual(['Beans', 'Coffee', 'merch']);
});

test('categoryTerms counts a product with two categories in both', () => {
  const terms = categoryTerms([{ id: 1, categories: [coffee, merch] }, { id: 2, categories: [coffee] }]);
  expect(terms).toEqual([{ id: 25, name: 'Coffee', count: 2 }, { id: 27, name: 'merch', count: 1 }]);
});

test('categoryTerms adds nothing for products with no categories', () => {
  expect(categoryTerms([{ id: 1 }, { id: 2, categories: [] }])).toEqual([]);
  expect(categoryTerms([{ id: 1 }, { id: 2, categories: [beans] }])).toEqual([{ id: 31, name: 'Beans', count: 1 }]);
});

test('productsInCategory keeps the products carrying the id', () => {
  const products = [{ id: 1, categories: [coffee] }, { id: 2, categories: [merch] }, { id: 3, categories: [merch, coffee] }, { id: 4 }];
  expect(productsInCategory(products, 25).map(doc => doc.id)).toEqual([1, 3]);
  expect(productsInCategory(products, 27).map(doc => doc.id)).toEqual([2, 3]);
  expect(productsInCategory(products, 99)).toEqual([]);
});

test('count labels use the singular for one', () => {
  expect(categoriesLabel(1)).toBe('1 category');
  expect(categoriesLabel(6)).toBe('6 categories');
  expect(productsLabel(1)).toBe('1 product');
  expect(productsLabel(100)).toBe('100 products');
});

test('filtersAtBaseline: empty on both sides is the baseline; anything moved is not', () => {
  expect(filtersAtBaseline({ stock_status: 'instock' }, { stock_status: 'instock' })).toBe(true);
  expect(filtersAtBaseline({ stock_status: 'instock', categories: [] }, { stock_status: 'instock' })).toBe(true);
  expect(filtersAtBaseline({}, { stock_status: 'instock' })).toBe(false);
  expect(filtersAtBaseline({ stock_status: 'instock', on_sale: true }, { stock_status: 'instock' })).toBe(false);
  expect(filtersAtBaseline({ categories: [25] }, {})).toBe(false);
});

test('browseBy defaults to categories, and a missing or unknown stored value reads as the default', () => {
  expect(CATALOGUE_VIEW_DEFAULTS.browseBy).toBe('categories');
  expect(readBrowseBy(undefined)).toBe('categories');
  expect(readBrowseBy('tags')).toBe('categories');
  expect(readBrowseBy('all')).toBe('all');
  const storage = new Map<string, string>();
  const store = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } } as Storage;
  // A state saved before the field existed.
  store.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ view: 'table', gridColumns: 4, sort: { field: 'name', dir: 'asc' }, showOutOfStock: true }));
  expect(loadCatalogueView(store)).toEqual({ ...CATALOGUE_VIEW_DEFAULTS, view: 'table', showOutOfStock: true });
  store.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
  expect(loadCatalogueView(store).browseBy).toBe('all');
});
