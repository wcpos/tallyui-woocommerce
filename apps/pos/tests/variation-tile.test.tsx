import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { CatalogueView } from '../components/catalogue-view';
import { CATALOGUE_VIEW_DEFAULTS, CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { classesOf } from './classes-of';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import variations from './fixtures/variations.json';

let data: Map<string, string>;
beforeEach(() => {
  data = new Map([[CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })]]);
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } });
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const docs = variations.documents.map(doc => doc.payload);
const shirt = (variationDocs: unknown[]) => ({ ...products[2], variation_docs: variationDocs });
const priced = (doc: (typeof docs)[number], price: string, regular = price) =>
  ({ ...doc, price, regular_price: regular, sale_price: price === regular ? '' : price, on_sale: price !== regular });

function renderTile(product: unknown) {
  render(<CatalogueView connector={createWooCommerceConnector()} currency={stores[0].currency} products={[product]}
    storeName={stores[0].name} cashierName="Paul" status="ready" onSignOut={() => {}} />);
}

test('A5: variants at $20 and $25 read "from" and the lowest price, in bold and never green', () => {
  renderTile(shirt([priced(docs[0], '20.00'), docs[1], docs[2]]));
  expect(screen.getByTestId('tile-from-102').textContent).toBe('from');
  expect(classesOf('tile-from-102')).toEqual(expect.arrayContaining(['text-xs', 'text-muted-foreground']));
  expect(screen.getByTestId('tile-price-102').textContent).toBe('$20.00');
  expect(classesOf('tile-price-102')).toEqual(expect.arrayContaining(['text-base', 'font-bold']));
  for (const testID of ['tile-from-102', 'tile-price-102']) {
    expect(classesOf(testID).filter(name => name === 'text-price' || name === 'text-sale')).toEqual([]);
  }
  expect(screen.getByTestId('tile-options-102').textContent).toBe('6 options');
});

test('A5: equal variant prices read the price alone', () => {
  renderTile(shirt(docs));
  expect(screen.queryByTestId('tile-from-102')).toBeNull();
  expect(screen.getByTestId('tile-price-102').textContent).toBe('$25.00');
});

test.each([[true, '$22.00'], [false, null]])('A5: with On Sale %s the cheapest variant on sale strikes its regular price', (onSale, was) => {
  data.set(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all', tileFields: { ...CATALOGUE_VIEW_DEFAULTS.tileFields, on_sale: onSale } }));
  renderTile(shirt([priced(docs[0], '20.00', '22.00'), docs[1]]));
  expect(screen.getByTestId('tile-price-102').textContent).toBe('$20.00');
  expect(screen.queryByTestId('tile-was-102')?.textContent ?? null).toBe(was);
});
