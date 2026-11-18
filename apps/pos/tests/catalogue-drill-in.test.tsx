import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { SaleScreen } from '../components/sale-screen';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { QUICK_FILTERS_KEY } from '../lib/catalogue/quick-filters';
import { classesOf } from './classes-of';
import { noTaxSettings } from './fixtures/store-settings';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import variations from './fixtures/variations.json';
import { cartTabCount } from './phone-tabs-helpers';

let data: Map<string, string>;
const view = (state: object) => data.set(CATALOGUE_VIEW_KEY, JSON.stringify(state));
beforeEach(() => {
  data = new Map();
  view({ browseBy: 'all' });
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
const outM = { ...shirt, variation_docs: docs.map(doc => doc.id === 106 ? { ...doc, stock_status: 'outofstock', stock_quantity: 0 } : doc) };

function renderView(items: unknown[] = [products[0], shirt], extra: Partial<CatalogueViewProps> = {}) {
  const onSelect = vi.fn(), onAddEntry = vi.fn();
  render(<CatalogueView connector={createWooCommerceConnector()} currency={stores[0].currency} products={items}
    storeName={stores[0].name} cashierName="Paul" status="ready" onSignOut={() => {}} onSelect={onSelect} onAddEntry={onAddEntry} {...extra} />);
  return { onSelect, onAddEntry };
}
const variationTiles = () => screen.queryAllByTestId(/^variation-tile-\d+$/).map(node => node.getAttribute('data-testid'));
const productTiles = () => screen.queryAllByTestId(/^product-tile-\d+$/).map(node => node.getAttribute('data-testid'));
const drillIn = () => fireEvent.click(screen.getByTestId('product-tile-102'));

test('a grid tap on a product with full variants drills in: back badge, crumb, parent tile, one tile per variant', () => {
  const { onSelect } = renderView();
  drillIn();
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.queryByTestId('variation-picker')).toBeNull();
  expect(screen.getByTestId('drill-back').getAttribute('aria-label')).toBe('Back');
  expect(screen.getByTestId('products-breadcrumb').textContent).toBe('ProductsT-Shirt');
  expect(screen.getByTestId('products-breadcrumb-here').textContent).toBe('T-Shirt');
  expect(productTiles()).toEqual(['product-tile-102']);
  expect(variationTiles()).toEqual(['variation-tile-104', 'variation-tile-105', 'variation-tile-106']);
  const tile = within(screen.getByTestId('variation-tile-106'));
  expect(tile.getByText('T-Shirt')).not.toBeNull();
  expect(screen.getByTestId('variation-chip-106-Size').textContent).toBe('M');
  expect(screen.getByTestId('variation-chip-106-Colour').textContent).toBe('Black');
  expect(screen.getByTestId('variation-price-106').textContent).toBe('$25.00');
  expect(screen.getByTestId('data-table-count').textContent).toBe('3 options');
});

test('tapping a variation tile adds that entry, and the drill-in stays', () => {
  const { onAddEntry, onSelect } = renderView();
  drillIn();
  fireEvent.click(screen.getByTestId('variation-tile-105'));
  expect(onAddEntry).toHaveBeenCalledTimes(1);
  expect(onAddEntry.mock.calls[0][0].variant.id).toBe('105');
  expect(onAddEntry.mock.calls[0][0].product.id).toBe(102);
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.getByTestId('drill-back')).not.toBeNull();
});

// v2's variation-tile.tsx:177: each variation tile's corner is InCartCount, that variation's own lines.
test('a variation tile\'s corner shows its own cart count; a sibling with none shows no badge', () => {
  renderView(undefined, { inCartCounts: new Map([['102', 5], ['104', 2]]) });
  drillIn();
  const badge = within(screen.getByTestId('variation-tile-104')).getByTestId('in-cart-variation-104');
  expect(badge.textContent).toBe('2');
  expect(badge.getAttribute('aria-label')).toBe('In cart: 2');
  expect(screen.queryByTestId('in-cart-variation-105')).toBeNull();
  expect(screen.queryByTestId('in-cart-variation-106')).toBeNull();
});

test('with nothing in the cart no variation tile has a badge', () => {
  renderView(undefined, { inCartCounts: new Map() });
  drillIn();
  expect(screen.queryAllByTestId(/^in-cart-variation-/)).toEqual([]);
});

test('the back badge returns to the product tiles', () => {
  renderView();
  drillIn();
  fireEvent.click(screen.getByTestId('drill-back'));
  expect(screen.queryByTestId('drill-back')).toBeNull();
  expect(variationTiles()).toEqual([]);
  expect(productTiles()).toEqual(['product-tile-80', 'product-tile-102']);
});

test('in a category the crumb ends in the product; the category crumb returns to its products, Categories to the root', () => {
  view({ browseBy: 'categories' });
  renderView();
  fireEvent.click(screen.getByTestId('browse-term-27'));
  drillIn();
  expect(screen.getByTestId('products-breadcrumb').textContent).toBe('CategoriesMerchT-Shirt');
  fireEvent.click(screen.getByTestId('products-breadcrumb-back'));
  expect(screen.queryByTestId('drill-back')).toBeNull();
  expect(productTiles()).toEqual(['product-tile-102']);
  expect(screen.getByTestId('products-breadcrumb').textContent).toBe('CategoriesMerch');
  drillIn();
  fireEvent.click(screen.getByTestId('products-breadcrumb-root'));
  expect(screen.getByTestId('browse-root')).not.toBeNull();
});

test('with In Stock on an out-of-stock variant is left out; with it off the variant reads Sold out', () => {
  renderView([outM]);
  drillIn();
  expect(variationTiles()).toEqual(['variation-tile-104', 'variation-tile-105']);
  expect(screen.getByTestId('data-table-count').textContent).toBe('2 options');
  fireEvent.click(screen.getByTestId('drill-back'));
  fireEvent.click(screen.getByTestId('filter-pill-remove-stock_status'));
  drillIn();
  expect(variationTiles()).toEqual(['variation-tile-104', 'variation-tile-105', 'variation-tile-106']);
  expect(screen.getByTestId('variation-sold-out-106').textContent).toBe('Sold out');
  expect(screen.getByTestId('tile-picture-variation-106').style.opacity).toBe('0.4');
});

test('typing in the search leaves the drill-in', () => {
  renderView();
  drillIn();
  expect(screen.getByTestId('drill-back')).not.toBeNull();
  fireEvent.change(screen.getByPlaceholderText('Search products'), { target: { value: 'shirt' } });
  expect(screen.queryByTestId('drill-back')).toBeNull();
  expect(variationTiles()).toEqual([]);
  expect(productTiles()).toEqual(['product-tile-102']);
});

test('a variant that leaves a group open ("Any") keeps the chooser path', () => {
  const anySize = { ...shirt, variation_docs: [docs[0], { ...docs[1], attributes: [{ id: 0, name: 'Colour', slug: 'colour', option: 'White' }] }] };
  const { onSelect } = renderView([anySize]);
  drillIn();
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('drill-back')).toBeNull();
});

// v2's variable-product-row.tsx and drill-in.tsx: in the table the row, or its trailing chevron, drills in too.
const variationRows = () => screen.queryAllByTestId(/^variation-row-\d+$/).map(node => node.getAttribute('data-testid'));
const expectTableDrill = (onSelect: ReturnType<typeof vi.fn>) => {
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.getByTestId('products-breadcrumb-here').textContent).toBe('T-Shirt');
  expect(screen.getByTestId('catalogue-variations-table')).not.toBeNull();
  expect(variationRows()).toEqual(['variation-row-104', 'variation-row-105', 'variation-row-106']);
  expect(screen.getByTestId('data-table-count').textContent).toBe('3 options');
};

test('in the table a click on a variable product drills into its variations as rows', () => {
  view({ browseBy: 'all', view: 'table' });
  const { onSelect } = renderView();
  fireEvent.click(screen.getByText('T-Shirt'));
  expectTableDrill(onSelect);
  expect(screen.getByTestId('variation-chip-106-Size').textContent).toBe('M');
  expect(screen.getByTestId('variation-price-106').textContent).toBe('$25.00');
});

test('in the table a variation row adds that entry, and the drill-in stays', () => {
  view({ browseBy: 'all', view: 'table' });
  const { onAddEntry, onSelect } = renderView();
  fireEvent.click(screen.getByText('T-Shirt'));
  fireEvent.click(screen.getByTestId('variation-row-106'));
  expect(onAddEntry).toHaveBeenCalledTimes(1);
  expect(onAddEntry.mock.calls[0][0].variant.id).toBe('106');
  expect(onAddEntry.mock.calls[0][0].product.id).toBe(102);
  expect(onSelect).not.toHaveBeenCalled();
  expect(variationRows()).toEqual(['variation-row-104', 'variation-row-105', 'variation-row-106']);
});

test('in the table the trailing chevron drills in the same way', () => {
  view({ browseBy: 'all', view: 'table' });
  const { onSelect } = renderView();
  const chevron = screen.getByTestId('variable-product-drill-102');
  expect(chevron.getAttribute('aria-label')).toBe('T-Shirt');
  fireEvent.click(chevron);
  expectTableDrill(onSelect);
});

test('in the table a variable product\'s name cell counts its options; a simple product\'s does not', () => {
  view({ browseBy: 'all', view: 'table' });
  renderView();
  expect(screen.getByTestId('product-options-102').textContent).toBe('3 options');
  expect(screen.queryAllByTestId(/^product-options-/).map(node => node.getAttribute('data-testid'))).toEqual(['product-options-102']);
});

test('in the table a product with an "Any" variant keeps the chooser path and has no chevron', () => {
  view({ browseBy: 'all', view: 'table' });
  const anySize = { ...shirt, variation_docs: [docs[0], { ...docs[1], attributes: [{ id: 0, name: 'Colour', slug: 'colour', option: 'White' }] }] };
  const { onSelect } = renderView([anySize]);
  expect(screen.queryAllByTestId(/^variable-product-drill-/)).toEqual([]);
  fireEvent.click(screen.getByText('T-Shirt'));
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(variationRows()).toEqual([]);
});

test('switching the view after a table drill-in leaves the drill-in', () => {
  view({ browseBy: 'all', view: 'table' });
  renderView();
  fireEvent.click(screen.getByText('T-Shirt'));
  expect(variationRows()).toHaveLength(3);
  fireEvent.click(screen.getByTestId('view-mode-toggle'));
  expect(screen.queryByTestId('drill-back')).toBeNull();
  expect(variationTiles()).toEqual([]);
  expect(productTiles()).toEqual(['product-tile-80', 'product-tile-102']);
});

test('on the till a variation tile adds its variant to the cart, with no picker', () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 600, height: 800, scale: 1, fontScale: 1 });
  render(<><SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency}
    products={[shirt]} storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}} /><PortalHost /></>);
  drillIn();
  expect(screen.queryByTestId('variation-picker')).toBeNull();
  fireEvent.click(screen.getByTestId('variation-tile-106'));
  expect(cartTabCount()).toBe('1');
  expect(screen.getByTestId('drill-back')).not.toBeNull();
});

test('on the till two taps on one variation put 2 in its corner and none on its siblings', () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 600, height: 800, scale: 1, fontScale: 1 });
  render(<><SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency}
    products={[shirt]} storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}} /><PortalHost /></>);
  drillIn();
  fireEvent.click(screen.getByTestId('variation-tile-104'));
  fireEvent.click(screen.getByTestId('variation-tile-104'));
  expect(screen.getByTestId('in-cart-variation-104').textContent).toBe('2');
  expect(screen.queryByTestId('in-cart-variation-105')).toBeNull();
  expect(screen.queryByTestId('in-cart-variation-106')).toBeNull();
});

// v2's filter-bar.tsx: `level === 'variations'` dims every chip but Stock status (Chip `dimmed`: opacity-45, disabled).
test('while drilled in, the product filter chips are dimmed and disabled; pressing one leaves the filters alone', () => {
  data.set(QUICK_FILTERS_KEY, JSON.stringify([{ id: 'sale', type: 'quick', label: 'Sale', conditions: [{ field: 'on_sale', value: true }] }]));
  renderView();
  drillIn();
  const onSale = screen.getByTestId('filter-pill-on_sale');
  expect(onSale.getAttribute('aria-disabled')).toBe('true');
  expect(classesOf('filter-pill-on_sale')).toContain('opacity-45');
  expect(screen.getByTestId('filter-pill-categories').getAttribute('aria-disabled')).toBe('true');
  expect(screen.getByTestId('quick-filter-sale').getAttribute('aria-disabled')).toBe('true');
  expect(screen.getByTestId('filter-pill-stock_status').getAttribute('aria-disabled')).toBeNull();
  fireEvent.click(onSale);
  fireEvent.click(screen.getByTestId('quick-filter-sale'));
  expect(onSale.getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByTestId('drill-back')).not.toBeNull();
  expect(variationTiles()).toEqual(['variation-tile-104', 'variation-tile-105', 'variation-tile-106']);
});

// v2's filter-bar.tsx:147-150: a dimmed chip opens nothing and has no ×; Stock status stays live, × and all.
test('while drilled in, an active Category chip loses its ×, and In Stock keeps its own', () => {
  render(<><CatalogueView connector={createWooCommerceConnector()} currency={stores[0].currency} products={[products[0], shirt]}
    storeName={stores[0].name} cashierName="Paul" status="ready" onSignOut={() => {}} onAddEntry={vi.fn()} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('filter-pill-categories'));
  fireEvent.click(screen.getByTestId('category-option-27'));
  expect(screen.getByTestId('filter-pill-remove-categories')).not.toBeNull();
  drillIn();
  expect(screen.getByTestId('drill-back')).not.toBeNull();
  expect(screen.getByTestId('filter-pill-categories').textContent).toBe('Merch');
  expect(screen.queryByTestId('filter-pill-remove-categories')).toBeNull();
  expect(screen.getByTestId('filter-pill-remove-stock_status')).not.toBeNull();
});

// v2's filter-bar.tsx:182-191: each dimmed chip is the trigger of a tooltip with `pos_products.product_filter_not_in_variations`
// (core en.json), which v2's web tooltip opens on hover. Stock status is never dimmed and has none, nor has a chip after Back.
test('while drilled in, a dimmed chip shows v2\'s tooltip on hover; an undimmed chip has none', () => {
  data.set(QUICK_FILTERS_KEY, JSON.stringify([{ id: 'sale', type: 'quick', label: 'Sale', conditions: [{ field: 'on_sale', value: true }] }]));
  render(<><CatalogueView connector={createWooCommerceConnector()} currency={stores[0].currency} products={[products[0], shirt]}
    storeName={stores[0].name} cashierName="Paul" status="ready" onSignOut={() => {}} onAddEntry={vi.fn()} /><PortalHost /></>);
  const tooltip = () => screen.queryByRole('tooltip')?.textContent ?? null;
  const hovered = (testID: string) => {
    fireEvent.pointerEnter(screen.getByTestId(testID));
    const shown = tooltip();
    fireEvent.pointerLeave(screen.getByTestId(testID));
    expect(tooltip()).toBeNull();
    return shown;
  };
  const chips = ['filter-pill-on_sale', 'filter-pill-categories', 'filter-pill-tags', 'quick-filter-sale'];
  for (const chip of chips) expect(hovered(chip)).toBeNull();
  drillIn();
  for (const chip of chips) expect(hovered(chip)).toBe('A product filter; not used inside a product’s variations.');
  expect(hovered('filter-pill-stock_status')).toBeNull();
  fireEvent.click(screen.getByTestId('drill-back'));
  for (const chip of chips) expect(hovered(chip)).toBeNull();
});

test('after the back chevron the chips work again', () => {
  renderView();
  drillIn();
  fireEvent.click(screen.getByTestId('drill-back'));
  const onSale = screen.getByTestId('filter-pill-on_sale');
  expect(onSale.getAttribute('aria-disabled')).toBeNull();
  expect(classesOf('filter-pill-on_sale')).not.toContain('opacity-45');
  fireEvent.click(onSale);
  expect(screen.getByTestId('filter-pill-on_sale').getAttribute('aria-pressed')).toBe('true');
});

test('Escape on a variation tile closes the drill-in and brings the product tiles back', () => {
  renderView();
  drillIn();
  expect(screen.queryByTestId('catalogue-level-back')).toBeNull();
  expect(screen.getByTestId('catalogue-drill-back')).not.toBeNull();
  fireEvent.keyDown(screen.getByTestId('variation-tile-104'), { key: 'Escape' });
  expect(screen.queryByTestId('drill-back')).toBeNull();
  expect(variationTiles()).toEqual([]);
  expect(productTiles()).toEqual(['product-tile-80', 'product-tile-102']);
  expect(screen.queryByTestId('catalogue-drill-back')).toBeNull();
});

test('Escape on a tile in a level returns to the root; another key does not', () => {
  view({ browseBy: 'categories' });
  renderView();
  fireEvent.click(screen.getByTestId('browse-term-27'));
  fireEvent.keyDown(screen.getByTestId('product-tile-102'), { key: 'Enter' });
  expect(screen.queryByTestId('browse-root')).toBeNull();
  expect(screen.getByTestId('products-breadcrumb').textContent).toBe('CategoriesMerch');
  fireEvent.keyDown(screen.getByTestId('product-tile-102'), { key: 'a' });
  expect(screen.queryByTestId('browse-root')).toBeNull();
  expect(screen.getByTestId('products-breadcrumb').textContent).toBe('CategoriesMerch');
  fireEvent.keyDown(screen.getByTestId('product-tile-102'), { key: 'Escape' });
  expect(screen.getByTestId('browse-root')).not.toBeNull();
  expect(screen.queryByTestId('catalogue-level-back')).toBeNull();
});

test('with a drill inside a level, one Escape closes only the drill and a second returns to the root', () => {
  view({ browseBy: 'categories' });
  renderView();
  fireEvent.click(screen.getByTestId('browse-term-27'));
  drillIn();
  expect(screen.getByTestId('catalogue-level-back').contains(screen.getByTestId('catalogue-drill-back'))).toBe(true);
  fireEvent.keyDown(screen.getByTestId('variation-tile-105'), { key: 'Escape' });
  expect(screen.queryByTestId('drill-back')).toBeNull();
  expect(productTiles()).toEqual(['product-tile-102']);
  expect(screen.getByTestId('products-breadcrumb').textContent).toBe('CategoriesMerch');
  expect(screen.queryByTestId('browse-root')).toBeNull();
  fireEvent.keyDown(screen.getByTestId('product-tile-102'), { key: 'Escape' });
  expect(screen.getByTestId('browse-root')).not.toBeNull();
});

test('Escape in the search input inside a level changes nothing', () => {
  // No guard of ours: react-native-web's TextInput stops the key (TextInput handleKeyDown, #612).
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1000, height: 800, scale: 1, fontScale: 1 });
  view({ browseBy: 'categories', view: 'table' });
  renderView();
  fireEvent.click(screen.getByTestId('browse-term-27'));
  const input = screen.getByPlaceholderText('Search products');
  expect(screen.getByTestId('catalogue-level-back').contains(input)).toBe(true);
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(screen.queryByTestId('browse-root')).toBeNull();
  expect(screen.getByTestId('products-breadcrumb').textContent).toBe('CategoriesMerch');
  expect(screen.getByTestId('product-row-102')).not.toBeNull();
});

test('at the root there is no level wrapper and Escape changes nothing', () => {
  view({ browseBy: 'categories' });
  renderView();
  expect(screen.queryByTestId('catalogue-level-back')).toBeNull();
  expect(screen.queryByTestId('catalogue-drill-back')).toBeNull();
  fireEvent.keyDown(screen.getByTestId('browse-term-27'), { key: 'Escape' });
  expect(screen.getByTestId('browse-root')).not.toBeNull();
  expect(productTiles()).toEqual([]);
});

// v2's Breadcrumb autoFocus (breadcrumb/index.tsx:30-41, drill-in.tsx:64, term-grid.tsx:303): each step mounts a crumb
// whose back control takes focus, so Escape walks back one step per press with no click.
const focusedCrumb = () => {
  const focused = document.activeElement as HTMLElement;
  expect(focused.getAttribute('data-testid')).toBe('products-breadcrumb-back');
  return focused.getAttribute('aria-label');
};
const drillInLevel = () => {
  view({ browseBy: 'categories' });
  renderView();
  fireEvent.click(screen.getByTestId('browse-term-27'));
  drillIn();
};

test('the drill-in crumb takes focus: its back button is the level', () => {
  drillInLevel();
  expect(focusedCrumb()).toBe('Merch');
});

test('Escape on the focused drill crumb closes the drill and focuses the level crumb', () => {
  drillInLevel();
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(screen.queryByTestId('drill-back')).toBeNull();
  expect(productTiles()).toEqual(['product-tile-102']);
  expect(focusedCrumb()).toBe('Categories');
});

test('a second Escape on the focused crumb returns to the root, with no click', () => {
  drillInLevel();
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(screen.getByTestId('browse-root')).not.toBeNull();
  expect(screen.queryByTestId('products-breadcrumb')).toBeNull();
});

test('the crumb focuses once on mount, without scrolling; a search in the level does not refocus it', () => {
  const focus = vi.spyOn(HTMLElement.prototype, 'focus');
  view({ browseBy: 'categories' });
  renderView();
  fireEvent.click(screen.getByTestId('browse-term-27'));
  expect(focus).toHaveBeenCalledTimes(1);
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  fireEvent.change(screen.getByPlaceholderText('Search products'), { target: { value: 'shirt' } });
  expect(screen.getByTestId('products-breadcrumb').textContent).toBe('CategoriesMerch');
  expect(focus).toHaveBeenCalledTimes(1);
});
