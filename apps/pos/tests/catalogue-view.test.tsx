import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { CATALOGUE_TILE_FIELDS, CATALOGUE_VIEW_DEFAULTS, CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

const props: CatalogueViewProps = {
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', status: 'ready', onSignOut: () => {},
};

test('renders fixture names, store, cashier and prices in the store currency', () => {
  render(<CatalogueView {...props} />);
  for (const product of products) expect(screen.getByText(product.name)).not.toBeNull();
  expect(screen.getByText(stores[0].name)).not.toBeNull();
  expect(screen.getByText('Cashier: Paul')).not.toBeNull();
  expect(screen.getByText('$3.00')).not.toBeNull();
  expect(screen.getByText('3 products')).not.toBeNull();
});

test.each([products[0].sku, products[0].global_unique_id, 'Espres'])('searches by %s', term => {
  render(<CatalogueView {...props} />);
  fireEvent.change(screen.getByPlaceholderText('Search name, SKU or barcode'), { target: { value: term } });
  expect(screen.getByText(products[0].name)).not.toBeNull();
  for (const product of products.slice(1)) expect(screen.queryByText(product.name)).toBeNull();
});

test('calls onSignOut', () => {
  const onSignOut = vi.fn();
  render(<CatalogueView {...props} onSignOut={onSignOut} />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(onSignOut).toHaveBeenCalledOnce();
});

test('the menu opens the drawer, and Orders closes it and opens orders', () => {
  const onOpenOrders = vi.fn();
  render(<><CatalogueView {...props} onOpenOrders={onOpenOrders} /><PortalHost /></>);
  expect(screen.queryByRole('button', { name: 'Orders' })).toBeNull();
  fireEvent.click(screen.getByTestId('pos-drawer-open-button'));
  fireEvent.click(screen.getByTestId('drawer-item-orders'));
  expect(onOpenOrders).toHaveBeenCalledOnce();
  expect(screen.queryByTestId('drawer-panel')).toBeNull();
});

test('Logs and Settings are in the drawer only when their handlers are supplied', () => {
  const onOpenLogs = vi.fn();
  const onOpenSettings = vi.fn();
  const { rerender } = render(<><CatalogueView {...props} onOpenLogs={onOpenLogs} onOpenSettings={onOpenSettings} /><PortalHost /></>);
  expect(screen.queryByTestId('settings-entry')).toBeNull();
  fireEvent.click(screen.getByTestId('pos-drawer-open-button'));
  fireEvent.click(screen.getByTestId('drawer-item-logs'));
  expect(onOpenLogs).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByTestId('pos-drawer-open-button'));
  fireEvent.click(screen.getByTestId('drawer-item-settings'));
  expect(onOpenSettings).toHaveBeenCalledOnce();
  rerender(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('pos-drawer-open-button'));
  expect(screen.getByTestId('drawer-panel')).not.toBeNull();
  expect(screen.queryByTestId('drawer-item-logs')).toBeNull();
  expect(screen.queryByTestId('drawer-item-settings')).toBeNull();
});

test('shows the syncing status', () => {
  render(<CatalogueView {...props} status="syncing" />);
  expect(screen.getByText('Syncing products…')).not.toBeNull();
});

test('shows notices and the error status on the single status line', () => {
  const { rerender } = render(<CatalogueView {...props} notice={{ code: 'auth', message: 'Sign in again' }} />);
  expect(screen.getByText('Sign in again')).not.toBeNull();
  expect(screen.queryByText('3 products')).toBeNull();
  rerender(<CatalogueView {...props} notice={{ code: 'auth' }} />);
  expect(screen.getByText('auth')).not.toBeNull();
  rerender(<CatalogueView {...props} status="error" />);
  expect(screen.getByText('Sync failed')).not.toBeNull();
});

test('distinguishes an empty catalogue from an unmatched search', () => {
  render(<CatalogueView {...props} products={[]} />);
  expect(screen.getByText('No products yet')).not.toBeNull();
  fireEvent.change(screen.getByPlaceholderText('Search name, SKU or barcode'), { target: { value: 'missing' } });
  expect(screen.getByText('No products match')).not.toBeNull();
});

test('shows the grid by default with names in ascending order', () => {
  render(<CatalogueView {...props} />);
  expect(screen.getByTestId('view-toggle-grid').getAttribute('aria-checked')).toBe('true');
  expect(screen.queryAllByTestId(/^product-row-/)).toHaveLength(0);
  expect(screen.getAllByText(/^(Espresso|Cold Brew|T-Shirt)$/).map(node => node.textContent)).toEqual(['Cold Brew', 'Espresso', 'T-Shirt']);
});

test('toggles to a name-sorted table and saves the view', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('view-toggle-table'));
  expect(screen.getAllByTestId(/^product-row-/).map(node => node.getAttribute('data-testid'))).toEqual(['product-row-84', 'product-row-80', 'product-row-102']);
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).view).toBe('table');
});

test('the table view survives a remount', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('view-toggle-table'));
  cleanup();
  render(<CatalogueView {...props} />);
  expect(screen.getByTestId('product-row-80')).not.toBeNull();
  expect(screen.getByTestId('view-toggle-table').getAttribute('aria-checked')).toBe('true');
});

test.each(['{not json', '{"view":"list","gridColumns":99}'])('bad stored value %s falls back to the name-sorted grid', raw => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, raw);
  render(<CatalogueView {...props} />);
  expect(screen.getByTestId('view-toggle-grid').getAttribute('aria-checked')).toBe('true');
  expect(screen.queryAllByTestId(/^product-row-/)).toHaveLength(0);
  expect(screen.getAllByText(/^(Espresso|Cold Brew|T-Shirt)$/).map(node => node.textContent)).toEqual(['Cold Brew', 'Espresso', 'T-Shirt']);
});

test('price header cycles through ascending, descending and unsorted and saves each sort', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('view-toggle-table'));
  fireEvent.click(screen.getByTestId('product-table-sort-price'));
  expect(screen.getAllByTestId(/^product-row-/).map(node => node.getAttribute('data-testid'))).toEqual(['product-row-80', 'product-row-84', 'product-row-102']);
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).sort).toEqual({ field: 'price', dir: 'asc' });
  fireEvent.click(screen.getByTestId('product-table-sort-price'));
  expect(screen.getAllByTestId(/^product-row-/).map(node => node.getAttribute('data-testid'))).toEqual(['product-row-102', 'product-row-84', 'product-row-80']);
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).sort).toEqual({ field: 'price', dir: 'desc' });
  fireEvent.click(screen.getByTestId('product-table-sort-price'));
  expect(screen.getAllByTestId(/^product-row-/).map(node => node.getAttribute('data-testid'))).toEqual(['product-row-80', 'product-row-84', 'product-row-102']);
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).sort).toBeNull();
});

test('the grid follows the stored sort', () => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, '{"view":"grid","gridColumns":4,"sort":{"field":"price","dir":"desc"},"categoryId":null}');
  render(<CatalogueView {...props} />);
  expect(screen.getAllByText(/^(Espresso|Cold Brew|T-Shirt)$/).map(node => node.textContent)).toEqual(['T-Shirt', 'Cold Brew', 'Espresso']);
});

test('pressing a table row selects its product once', () => {
  const onSelect = vi.fn();
  render(<CatalogueView {...props} onSelect={onSelect} />);
  fireEvent.click(screen.getByTestId('view-toggle-table'));
  fireEvent.click(screen.getByTestId('product-row-80'));
  expect(onSelect).toHaveBeenCalledOnce();
  expect(onSelect).toHaveBeenCalledWith(products[0]);
});

test('search filters the table', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('view-toggle-table'));
  fireEvent.change(screen.getByPlaceholderText('Search name, SKU or barcode'), { target: { value: 'Espres' } });
  expect(screen.getAllByTestId(/^product-row-/).map(node => node.getAttribute('data-testid'))).toEqual(['product-row-80']);
});

test('search text survives toggling views', () => {
  render(<CatalogueView {...props} />);
  fireEvent.change(screen.getByPlaceholderText('Search name, SKU or barcode'), { target: { value: 'Espres' } });
  fireEvent.click(screen.getByTestId('view-toggle-table'));
  expect(screen.getAllByTestId(/^product-row-/).map(node => node.getAttribute('data-testid'))).toEqual(['product-row-80']);
  fireEvent.click(screen.getByTestId('view-toggle-grid'));
  expect(screen.getAllByText(/^(Espresso|Cold Brew|T-Shirt)$/).map(node => node.textContent)).toEqual(['Espresso']);
});

function gridCellWidth(): number {
  let cell = screen.getByText(products[0].name).parentElement;
  while (cell && !cell.style.width.endsWith('%')) cell = cell.parentElement;
  expect(cell, document.body.innerHTML).not.toBeNull();
  return parseFloat(cell!.style.width);
}

test('the tile size slider changes the wide grid immediately and saves the selection', () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1280, height: 800, scale: 1, fontScale: 1 });
  render(<><CatalogueView {...props} /><PortalHost /></>);
  expect(gridCellWidth()).toBeCloseTo(25);
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  const thumb = screen.getByRole('slider');
  expect(thumb.getAttribute('aria-valuenow')).toBe('4');
  fireEvent.keyDown(thumb, { key: 'ArrowRight' });
  fireEvent.keyDown(thumb, { key: 'ArrowRight' });
  expect(gridCellWidth()).toBeCloseTo(100 / 6);
  expect(thumb.getAttribute('aria-valuenow')).toBe('6');
  expect(screen.getByTestId('tile-size-value').textContent).toBe('6');
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).gridColumns).toBe(6);
  fireEvent.keyDown(thumb, { key: 'End' });
  expect(thumb.getAttribute('aria-valuenow')).toBe('8');
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).gridColumns).toBe(8);
  fireEvent.keyDown(thumb, { key: 'ArrowRight' });
  expect(thumb.getAttribute('aria-valuenow')).toBe('8');
  fireEvent.keyDown(thumb, { key: 'Home' });
  expect(thumb.getAttribute('aria-valuenow')).toBe('2');
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).gridColumns).toBe(2);
  expect(gridCellWidth()).toBeCloseTo(50);
});

test('phones keep two tiles per row with a stored size of six', () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 1 });
  localStorage.setItem(CATALOGUE_VIEW_KEY, '{"gridColumns":6}');
  render(<CatalogueView {...props} />);
  expect(gridCellWidth()).toBeCloseTo(50);
});

test('column switches update the table immediately and survive a remount', () => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, '{"view":"table"}');
  const { unmount } = render(<><CatalogueView {...props} /><PortalHost /></>);
  expect(screen.queryByTestId('product-table-sort-sku')).toBeNull();
  expect(screen.getByTestId('product-table-sort-category')).not.toBeNull();
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  fireEvent.click(screen.getByRole('switch', { name: 'Show SKU' }));
  fireEvent.click(screen.getByRole('switch', { name: 'Show Category' }));
  expect(screen.getByTestId('product-table-sort-sku')).not.toBeNull();
  expect(screen.queryByTestId('product-table-sort-category')).toBeNull();
  expect(screen.getByText(products[0].sku)).not.toBeNull();
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).columns).toEqual([
    { id: 'name', visible: true }, { id: 'price', visible: true }, { id: 'stock', visible: true },
    { id: 'category', visible: false }, { id: 'sku', visible: true }, { id: 'barcode', visible: false },
  ]);
  unmount();
  render(<><CatalogueView {...props} /><PortalHost /></>);
  expect(screen.getByTestId('product-table-sort-sku')).not.toBeNull();
  expect(screen.queryByTestId('product-table-sort-category')).toBeNull();
  expect(screen.getByText(products[0].sku)).not.toBeNull();
});

test('the name column switch is disabled and cannot hide the name', () => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, '{"view":"table"}');
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  const toggle = screen.getByRole('switch', { name: 'Show Name' });
  expect(toggle.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-checked')).toBe('true');
  expect(screen.getByTestId('product-table-sort-name')).not.toBeNull();
});

test.each(['grid', 'table'])('%s settings show only the relevant controls and close', view => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ view }));
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  if (view === 'grid') {
    expect(screen.getByText('Tile size')).not.toBeNull();
    expect(screen.getByRole('slider').getAttribute('aria-valuenow')).toBe('4');
    expect(screen.queryAllByTestId(/^column-toggle-/)).toHaveLength(0);
    expect(screen.getAllByTestId(/^tile-field-toggle-/).map(node => node.getAttribute('data-testid'))).toEqual(CATALOGUE_TILE_FIELDS.map(({ id }) => `tile-field-toggle-${id}`));
  } else {
    expect(screen.getByTestId('column-toggle-name')).not.toBeNull();
    expect(screen.queryAllByRole('slider')).toHaveLength(0);
    expect(screen.queryAllByTestId(/^tile-field-toggle-/)).toHaveLength(0);
  }
  fireEvent.click(screen.getByTestId('catalogue-settings-close'));
  expect(screen.queryByTestId('catalogue-settings')).toBeNull();
});

test('restore resets the whole catalogue and keeps the settings dialog open', () => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, '{"view":"table","gridColumns":7,"sort":{"field":"price","dir":"desc"},"categoryId":null,"columns":[{"id":"sku","visible":true}]}');
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  fireEvent.click(screen.getByTestId('catalogue-settings-restore'));
  expect(screen.getByTestId('view-toggle-grid').getAttribute('aria-checked')).toBe('true');
  expect(localStorage.getItem(CATALOGUE_VIEW_KEY)).toBe(JSON.stringify(CATALOGUE_VIEW_DEFAULTS));
  expect(screen.getByTestId('catalogue-settings')).not.toBeNull();
  expect(screen.getByRole('slider').getAttribute('aria-valuenow')).toBe('4');
});

test('Product settings has no panel position and its restore keeps the side', () => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, '{"view":"table","position":"right"}');
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  expect(screen.queryByText('Panel position')).toBeNull();
  expect(screen.queryByTestId('panel-position-left')).toBeNull();
  fireEvent.click(screen.getByTestId('catalogue-settings-restore'));
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!)).toEqual({ ...CATALOGUE_VIEW_DEFAULTS, position: 'right' });
  expect(screen.getByTestId('view-toggle-grid').getAttribute('aria-checked')).toBe('true');
});

test('default tiles show name and price without optional fields', () => {
  render(<CatalogueView {...props} />);
  const tile = within(screen.getByTestId('product-tile-80'));
  expect(tile.getByText('Espresso')).not.toBeNull();
  expect(tile.getByText('$3.00')).not.toBeNull();
  expect(tile.queryByText('COF-ESP')).toBeNull();
  expect(tile.queryByText('2000000000015')).toBeNull();
  expect(tile.queryByText('Coffee')).toBeNull();
  expect(screen.getByTestId('product-tile-80').textContent).not.toContain('In Stock');
});

test('the SKU tile switch updates immediately, saves and survives a remount', () => {
  const { unmount } = render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  fireEvent.click(screen.getByRole('switch', { name: 'Show SKU on tiles' }));
  expect(within(screen.getByTestId('product-tile-80')).getByText('COF-ESP')).not.toBeNull();
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).tileFields.sku).toBe(true);
  unmount();
  render(<><CatalogueView {...props} /><PortalHost /></>);
  expect(within(screen.getByTestId('product-tile-80')).getByText('COF-ESP')).not.toBeNull();
});

test('category, barcode and stock switches show their tile fields', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  for (const label of ['Category', 'Barcode', 'Stock']) {
    fireEvent.click(screen.getByRole('switch', { name: `Show ${label} on tiles` }));
  }
  const tile = within(screen.getByTestId('product-tile-80'));
  expect(tile.getByText('Coffee')).not.toBeNull();
  expect(tile.getByText('2000000000015')).not.toBeNull();
  expect(screen.getByTestId('tile-stock-80').textContent).toBe('100 left');
});

test('the price tile switch hides price and keeps name visible', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  fireEvent.click(screen.getByRole('switch', { name: 'Show Price on tiles' }));
  const tile = within(screen.getByTestId('product-tile-80'));
  expect(tile.queryByText('$3.00')).toBeNull();
  expect(tile.getByText('Espresso')).not.toBeNull();
});

test('the name tile switch hides name and keeps price visible', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  fireEvent.click(screen.getByRole('switch', { name: 'Show Name on tiles' }));
  const tile = within(screen.getByTestId('product-tile-80'));
  expect(tile.queryByText('Espresso')).toBeNull();
  expect(tile.getByText('$3.00')).not.toBeNull();
});

test('restore resets tile fields and saves the complete defaults', () => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, '{"tileFields":{"name":false,"price":false,"sku":true,"stock":true}}');
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  fireEvent.click(screen.getByTestId('catalogue-settings-restore'));
  const tile = within(screen.getByTestId('product-tile-80'));
  expect(tile.getByText('Espresso')).not.toBeNull();
  expect(tile.getByText('$3.00')).not.toBeNull();
  expect(tile.queryByText('COF-ESP')).toBeNull();
  expect(localStorage.getItem(CATALOGUE_VIEW_KEY)).toBe(JSON.stringify(CATALOGUE_VIEW_DEFAULTS));
});

test('pressing a grid tile selects its product once', () => {
  const onSelect = vi.fn();
  render(<CatalogueView {...props} onSelect={onSelect} />);
  fireEvent.click(screen.getByTestId('product-tile-84'));
  expect(onSelect).toHaveBeenCalledOnce();
  expect(onSelect).toHaveBeenCalledWith(products[1]);
});

function openTileFields(...labels: string[]) {
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  for (const label of labels) fireEvent.click(screen.getByRole('switch', { name: `Show ${label} on tiles` }));
}

test('the On Sale tile field strikes the regular price only when on', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  const tile = screen.getByTestId('product-tile-84');
  expect(within(tile).getByText('$4.00')).not.toBeNull();
  expect(screen.queryByTestId('tile-was-84')).toBeNull();
  expect(tile.textContent).not.toContain('$5.00');
  openTileFields('On Sale');
  expect(screen.getByTestId('tile-was-84').textContent).toBe('$5.00');
});

test('the Tax tile field shows the till\'s tax for a taxable product', () => {
  render(<><CatalogueView {...props} products={[{ ...products[0], tax_status: 'taxable' }]}
    tax={{ pricesIncludeTax: false, getTaxRatePpm: () => 100000 }} /><PortalHost /></>);
  expect(screen.queryByTestId('tile-tax-80')).toBeNull();
  openTileFields('Tax');
  expect(screen.getByTestId('tile-tax-80').textContent).toBe('excl. $0.30 tax');
});

test('the Tax tile field shows nothing without the till\'s tax', () => {
  render(<><CatalogueView {...props} products={[{ ...products[0], tax_status: 'taxable' }]} /><PortalHost /></>);
  openTileFields('Tax');
  expect(screen.queryByTestId('tile-tax-80')).toBeNull();
});

test('a sold-out product says Sold out instead of its price', () => {
  render(<><CatalogueView {...props} products={[{ ...products[0], stock_status: 'outofstock', stock_quantity: 0 }]} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('filter-pill-remove-stock_status'));
  expect(screen.getByTestId('tile-sold-out-80').textContent).toBe('Sold out');
  expect(screen.getByTestId('product-tile-80').textContent).not.toContain('$3.00');
  openTileFields('Price');
  expect(screen.queryByTestId('tile-sold-out-80')).toBeNull();
});

test('a variable product is never sold out and has no stock mark', () => {
  render(<><CatalogueView {...props} products={[{ ...products[2], stock_status: 'outofstock', manage_stock: true, stock_quantity: 5 }]} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('filter-pill-remove-stock_status'));
  expect(screen.getByTestId('product-tile-102')).not.toBeNull();
  openTileFields('Stock');
  expect(screen.queryByTestId('tile-sold-out-102')).toBeNull();
  expect(screen.queryByTestId('tile-stock-102')).toBeNull();
});

test('Stock shows Backorder for a product that sells at none', () => {
  render(<><CatalogueView {...props} products={[{ ...products[0], stock_status: 'onbackorder', stock_quantity: 0 }]} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('filter-pill-remove-stock_status'));
  openTileFields('Stock');
  expect(screen.getByTestId('tile-stock-80').textContent).toBe('Backorder');
  expect(within(screen.getByTestId('product-tile-80')).getByText('$3.00')).not.toBeNull();
});

test('tiles show the in-cart count and no badge at zero', () => {
  render(<><CatalogueView {...props} inCartCounts={new Map([['80', 2]])} /><PortalHost /></>);
  expect(screen.getByTestId('in-cart-tile-80').textContent).toBe('2');
  expect(screen.getByLabelText('In cart: 2')).not.toBeNull();
  expect(screen.queryByTestId('in-cart-tile-84')).toBeNull();
});

test('table rows show the in-cart count and keep their order', () => {
  render(<><CatalogueView {...props} inCartCounts={new Map([['80', 3]])} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('view-toggle-table'));
  expect(screen.getByTestId('in-cart-row-80').textContent).toBe('3');
  expect(screen.queryByTestId('in-cart-row-84')).toBeNull();
  expect(screen.getAllByTestId(/^product-row-/).map(row => row.getAttribute('data-testid'))).toEqual(['product-row-84', 'product-row-80', 'product-row-102']);
});

test('a variable tile says how many options it has and stacks two cards behind it', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  expect(screen.getByTestId('tile-options-102').textContent).toBe('6 options');
  expect(screen.getByTestId('tile-stack-102').children.length).toBe(2);
  expect(screen.queryByTestId('tile-options-80')).toBeNull();
  expect(screen.queryByTestId('tile-stack-80')).toBeNull();
});

test('a product photo fills the tile under the card-colour scrim', () => {
  render(<CatalogueView {...props} />);
  expect(screen.getByTestId('tile-image-80')).not.toBeNull();
  expect(screen.queryByTestId('tile-initial-80')).toBeNull();
  expect(within(screen.getByTestId('tile-scrim-80')).getByText('Espresso')).not.toBeNull();
});

test('a product without a photo shows its initial on a tint and no scrim', () => {
  render(<CatalogueView {...props} products={[{ ...products[0], images: [] }]} />);
  expect(screen.getByTestId('tile-initial-80').textContent).toBe('E');
  expect(screen.queryByTestId('tile-image-80')).toBeNull();
  expect(screen.queryByTestId('tile-scrim-80')).toBeNull();
  expect(within(screen.getByTestId('product-tile-80')).getByText('$3.00')).not.toBeNull();
});

test('a sold-out tile greys its picture and an in-stock one does not', () => {
  render(<><CatalogueView {...props} products={[{ ...products[0], stock_status: 'outofstock', stock_quantity: 0 }, products[1]]} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('filter-pill-remove-stock_status'));
  expect(screen.getByTestId('tile-picture-80').style.opacity).toBe('0.4');
  expect(screen.getByTestId('tile-picture-84').style.opacity).toBe('');
});

test('the stock mark stays on the tile when Stock is on', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  openTileFields('Stock');
  expect(within(screen.getByTestId('product-tile-80')).getByTestId('tile-stock-80').textContent).toBe('100 left');
});
