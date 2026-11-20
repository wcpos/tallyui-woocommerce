import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { SaleScreen } from '../components/sale-screen';
import { CATALOGUE_VIEW_KEY, loadCatalogueView } from '../lib/catalogue/catalogue-view-state';
import { noTaxSettings } from './fixtures/store-settings';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import variations from './fixtures/variations.json';
import { cartTabCount } from './phone-tabs-helpers';

// v2's `variationsStyle: 'inline'` in grid view (tiles/inline-variable-tile.tsx): a variable product's tile opens a
// popover holding the variation picker; Add puts the variation in the cart and closes it.
let data: Map<string, string>;
const view = (state: object) => data.set(CATALOGUE_VIEW_KEY, JSON.stringify(state));
beforeEach(() => {
  data = new Map();
  view({ browseBy: 'all', variationsStyle: 'inline' });
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } });
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

// T-Shirt (102, Merch) with three full variants: S / Black (104), S / White (105), M / Black (106).
const attributes = [
  { id: 0, name: 'Size', position: 0, visible: true, variation: true, options: ['S', 'M'] },
  { id: 0, name: 'Colour', position: 1, visible: true, variation: true, options: ['Black', 'White'] },
];
const docs = variations.documents.map(doc => ({ ...doc.payload, barcode: doc.payload.global_unique_id }));
const shirt = { ...products[2], attributes, variation_docs: docs };
// As catalogue-drill-in.test: 105 leaves Size open ("Any").
const anySize = { ...shirt, variation_docs: [docs[0], { ...docs[1], attributes: [{ id: 0, name: 'Colour', slug: 'colour', option: 'White' }] }] };

function renderView(items: unknown[] = [products[0], shirt], extra: Partial<CatalogueViewProps> = {}) {
  const onSelect = vi.fn(), onAddEntry = vi.fn();
  render(<><CatalogueView connector={createWooCommerceConnector()} currency={stores[0].currency} products={items}
    storeName={stores[0].name} cashierName="Paul" status="ready" onSignOut={() => {}} onSelect={onSelect} onAddEntry={onAddEntry} {...extra} />
  <PortalHost /></>);
  return { onSelect, onAddEntry };
}
const variationTiles = () => screen.queryAllByTestId(/^variation-tile-\d+$/);
const openPopover = () => fireEvent.click(screen.getByTestId('variable-product-tile-102'));
const popover = () => screen.queryByTestId('variations-popover-102');
const pick = (value: string) => fireEvent.click(within(popover()!).getByText(value));
const add = () => fireEvent.click(screen.getByTestId('variation-popover-add-to-cart'));

test('in inline mode a grid tap opens the variations popover with the bare picker, and does not drill in', () => {
  const { onSelect, onAddEntry } = renderView();
  openPopover();
  expect(within(popover()!).getByTestId('variation-picker')).not.toBeNull();
  expect(variationTiles()).toEqual([]);
  expect(screen.queryByTestId('drill-back')).toBeNull();
  expect(onSelect).not.toHaveBeenCalled();
  expect(onAddEntry).not.toHaveBeenCalled();
  expect(within(popover()!).queryByText('Cancel')).toBeNull();
  expect(within(popover()!).queryByText('T-Shirt')).toBeNull();
});

test('choosing S and Black then Add passes the entry for 104 once and closes the popover', () => {
  const { onAddEntry } = renderView();
  openPopover();
  pick('S');
  pick('Black');
  add();
  expect(onAddEntry).toHaveBeenCalledTimes(1);
  expect(onAddEntry.mock.calls[0][0].variant.id).toBe('104');
  expect(popover()).toBeNull();
});

test('with no variationsStyle stored the tap drills in, with no popover', () => {
  view({ browseBy: 'all' });
  renderView();
  fireEvent.click(screen.getByTestId('product-tile-102'));
  expect(screen.getByTestId('variation-tile-104')).not.toBeNull();
  expect(screen.queryByTestId('variable-product-tile-102')).toBeNull();
  expect(popover()).toBeNull();
});

test('in the table inline mode still drills in on a row click', () => {
  view({ browseBy: 'all', variationsStyle: 'inline', view: 'table' });
  const { onSelect } = renderView();
  fireEvent.click(screen.getByText('T-Shirt'));
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.getByTestId('catalogue-variations-table')).not.toBeNull();
  expect(popover()).toBeNull();
});

test('Escape closes an open popover without adding', () => {
  const { onAddEntry } = renderView();
  openPopover();
  expect(popover()).not.toBeNull();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(popover()).toBeNull();
  expect(onAddEntry).not.toHaveBeenCalled();
});

test('a product with an "Any" variant opens the popover too, and Add carries the picked value', () => {
  const { onSelect, onAddEntry } = renderView([anySize]);
  openPopover();
  expect(onSelect).not.toHaveBeenCalled();
  pick('M');
  pick('White');
  add();
  expect(onAddEntry).toHaveBeenCalledTimes(1);
  const entry = onAddEntry.mock.calls[0][0];
  expect(entry.variant.id).toBe('105');
  expect(entry.picks).toEqual({ Size: 'M' });
});

test('loadCatalogueView reads only "inline" as inline; an unknown or missing value reads as drill', () => {
  const storage = (value: object) => ({ getItem: () => JSON.stringify(value) }) as unknown as Storage;
  expect(loadCatalogueView(storage({ variationsStyle: 'popover' })).variationsStyle).toBe('drill');
  expect(loadCatalogueView(storage({})).variationsStyle).toBe('drill');
  expect(loadCatalogueView(storage({ variationsStyle: 'inline' })).variationsStyle).toBe('inline');
});

test('on the till inline mode and Add put the variation in the cart', () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 600, height: 800, scale: 1, fontScale: 1 });
  render(<><SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency}
    products={[shirt]} storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}} /><PortalHost /></>);
  expect(cartTabCount()).toBe('New');
  openPopover();
  pick('S');
  pick('Black');
  add();
  expect(cartTabCount()).toBe('1');
  expect(popover()).toBeNull();
});
