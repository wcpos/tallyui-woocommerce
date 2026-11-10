import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { catalogueEntries, TaxProvider, useSale } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { CartSettingsDialog, CartWithSettings } from '../components/cart-settings';
import { CART_SETTINGS_KEY, loadCartSettings, saveCartSettings, sortCartLines } from '../lib/sale/cart-settings';
import type { PanelPosition } from '../lib/catalogue/catalogue-view-state';
import products from './fixtures/products.json';

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => [...data.keys()][index] ?? null,
    removeItem: key => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
}

const connector = createWooCommerceConnector();
const coldBrew = products[1];
const espresso = products[0];
const bananaBread = { ...products[0], id: 90, name: 'Banana Bread', price: '3.50', regular_price: '3.50' };

let latest: ReturnType<typeof useSale>;

function Harness({ position = 'left', onPositionChange = () => {} }: { position?: PanelPosition; onPositionChange?(next: PanelPosition): void }) {
  const sale = useSale({ currency: 'USD' }, { registerId: 'web', cashierRef: '2' });
  latest = sale;
  return <CartWithSettings sale={sale} position={position} onPositionChange={onPositionChange} openOrders={<span data-testid="open-orders-node" />} />;
}

function renderCart(props: { position?: PanelPosition; onPositionChange?(next: PanelPosition): void } = {}) {
  return render(<><TaxProvider ratesPpm={{}} pricesIncludeTax={false}><Harness {...props} /></TaxProvider><PortalHost /></>);
}

function addAll() {
  for (const p of [coldBrew, espresso, bananaBread]) {
    act(() => latest.add(catalogueEntries([p], connector.traits.product, { currency: 'USD' })[0], connector.traits.product));
  }
}

const shown = () => screen.getAllByRole('button', { name: /^Remove / }).map(b => b.getAttribute('aria-label'));
const kept = () => latest.order.lineItems.map(l => l.name);

test.each([
  ['newest_bottom', ['Zebra', 'Apple', 'Bear']],
  ['newest_top', ['Bear', 'Apple', 'Zebra']],
  ['name', ['Apple', 'Bear', 'Zebra']],
  ['price', ['Bear', 'Zebra', 'Apple']],
] as const)('sortCartLines %s orders the lines without mutating them', (sort, expected) => {
  const lines = [{ name: 'Zebra', unitPriceMinor: 200 }, { name: 'Apple', unitPriceMinor: 300 }, { name: 'Bear', unitPriceMinor: 100 }];
  const before = lines.map(line => ({ ...line }));
  const sorted = sortCartLines(lines, sort);
  expect(sorted.map(line => line.name)).toEqual(expected);
  expect(lines).toEqual(before);
  expect(sorted).not.toBe(lines);
});

test('sortCartLines keeps the add order between equal names and equal prices', () => {
  const lines = [{ id: 'a', name: 'Tea', unitPriceMinor: 300 }, { id: 'b', name: 'Tea', unitPriceMinor: 300 }];
  expect(sortCartLines(lines, 'name').map(line => line.id)).toEqual(['a', 'b']);
  expect(sortCartLines(lines, 'price').map(line => line.id)).toEqual(['a', 'b']);
});

test('saved cart settings load with newest at top as the fallback', () => {
  const storage = memoryStorage();
  expect(loadCartSettings(storage)).toEqual({ sortLines: 'newest_top', openOrdersPosition: 'bottom' });
  storage.setItem(CART_SETTINGS_KEY, '{"sortLines":"price"}');
  expect(loadCartSettings(storage).sortLines).toBe('price');
  storage.setItem(CART_SETTINGS_KEY, '{"sortLines":"oldest"}');
  expect(loadCartSettings(storage).sortLines).toBe('newest_top');
  storage.setItem(CART_SETTINGS_KEY, 'not json');
  expect(loadCartSettings(storage).sortLines).toBe('newest_top');
  const throwing = { ...memoryStorage(), getItem: () => { throw new Error('blocked'); } } as Storage;
  expect(loadCartSettings(throwing).sortLines).toBe('newest_top');
});

test('saving cart settings writes the device key and ignores a refusing storage', () => {
  const storage = memoryStorage();
  saveCartSettings({ sortLines: 'name', openOrdersPosition: 'bottom' }, storage);
  expect(storage.getItem(CART_SETTINGS_KEY)).toBe('{"sortLines":"name","openOrdersPosition":"bottom"}');
  const refusing = { ...memoryStorage(), setItem: () => { throw new Error('full'); } } as Storage;
  expect(() => saveCartSettings({ sortLines: 'name', openOrdersPosition: 'bottom' }, refusing)).not.toThrow();
});

test('the cart shows the newest line at the top by default and leaves the order alone', () => {
  renderCart();
  addAll();
  expect(shown()).toEqual(['Remove Banana Bread', 'Remove Espresso', 'Remove Cold Brew']);
  expect(kept()).toEqual(['Cold Brew', 'Espresso', 'Banana Bread']);
});

test('choosing a sort in Cart Settings reorders the shown lines and saves it for this device', () => {
  renderCart();
  addAll();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  const dialog = screen.getByTestId('cart-settings');
  expect(within(dialog).getByText('Cart Settings')).not.toBeNull();
  expect(screen.getByTestId('cart-sort-items-hint').textContent).toBe('Fees and shipping always stay last');
  expect(screen.getByTestId('cart-sort-items').textContent).toBe('Newest at top');
  fireEvent.click(screen.getByTestId('cart-sort-items'));
  fireEvent.click(screen.getByTestId('cart-sort-items-option-name'));
  expect(shown()).toEqual(['Remove Banana Bread', 'Remove Cold Brew', 'Remove Espresso']);
  expect(screen.getByTestId('cart-sort-items').textContent).toBe('Name');
  expect(localStorage.getItem(CART_SETTINGS_KEY)).toBe('{"sortLines":"name","openOrdersPosition":"bottom"}');
  expect(kept()).toEqual(['Cold Brew', 'Espresso', 'Banana Bread']);
  fireEvent.click(screen.getByTestId('cart-sort-items'));
  fireEvent.click(screen.getByTestId('cart-sort-items-option-price'));
  expect(shown()).toEqual(['Remove Espresso', 'Remove Banana Bread', 'Remove Cold Brew']);
  expect(kept()).toEqual(['Cold Brew', 'Espresso', 'Banana Bread']);
});

test('a saved sort applies when the cart opens', () => {
  localStorage.setItem(CART_SETTINGS_KEY, '{"sortLines":"newest_bottom"}');
  renderCart();
  addAll();
  expect(shown()).toEqual(['Remove Cold Brew', 'Remove Espresso', 'Remove Banana Bread']);
});

test('Cart left and Cart right show the side and report the products side', () => {
  const onPositionChange = vi.fn();
  renderCart({ position: 'left', onPositionChange });
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  expect(within(screen.getByTestId('cart-settings')).getByText('Panel position')).not.toBeNull();
  expect(screen.getByTestId('cart-setting-panel-position')).not.toBeNull();
  expect(screen.getByTestId('cart-setting-panel-position-right').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('cart-setting-panel-position-left').getAttribute('aria-selected')).toBe('false');
  fireEvent.click(screen.getByTestId('cart-setting-panel-position-left'));
  expect(onPositionChange).toHaveBeenLastCalledWith('right');
  fireEvent.click(screen.getByTestId('cart-setting-panel-position-right'));
  expect(onPositionChange).toHaveBeenLastCalledWith('left');
});

test('Restore Default Settings puts the cart right and newest at top and keeps the dialog open', () => {
  localStorage.setItem(CART_SETTINGS_KEY, '{"sortLines":"price"}');
  const onPositionChange = vi.fn();
  renderCart({ position: 'right', onPositionChange });
  addAll();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  fireEvent.click(screen.getByTestId('ui-settings-restore-defaults'));
  expect(onPositionChange).toHaveBeenCalledWith('left');
  expect(localStorage.getItem(CART_SETTINGS_KEY)).toBe('{"sortLines":"newest_top","openOrdersPosition":"bottom"}');
  expect(shown()).toEqual(['Remove Banana Bread', 'Remove Espresso', 'Remove Cold Brew']);
  expect(screen.getByTestId('cart-settings')).not.toBeNull();
  fireEvent.click(screen.getByTestId('ui-settings-close'));
  expect(screen.queryByTestId('cart-settings')).toBeNull();
});

test('open orders position loads as bottom unless top was saved, keeping an older sort', () => {
  const storage = memoryStorage();
  expect(loadCartSettings(storage).openOrdersPosition).toBe('bottom');
  storage.setItem(CART_SETTINGS_KEY, '{"sortLines":"name"}');
  expect(loadCartSettings(storage)).toEqual({ sortLines: 'name', openOrdersPosition: 'bottom' });
  storage.setItem(CART_SETTINGS_KEY, '{"sortLines":"name","openOrdersPosition":"sideways"}');
  expect(loadCartSettings(storage).openOrdersPosition).toBe('bottom');
  storage.setItem(CART_SETTINGS_KEY, '{"sortLines":"name","openOrdersPosition":"top"}');
  expect(loadCartSettings(storage).openOrdersPosition).toBe('top');
});

test('Open orders position shows Bottom selected and Top keeps the other settings', () => {
  const onSettingsChange = vi.fn();
  render(<><CartSettingsDialog position="left" onPositionChange={() => {}}
    settings={{ sortLines: 'name', openOrdersPosition: 'bottom' }} onSettingsChange={onSettingsChange} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  expect(within(screen.getByTestId('cart-settings')).getByText('Open orders position')).not.toBeNull();
  expect(screen.getByTestId('cart-setting-open-orders-top').textContent).toBe('Top');
  expect(screen.getByTestId('cart-setting-open-orders-bottom').textContent).toBe('Bottom');
  expect(screen.getByTestId('cart-setting-open-orders-bottom').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('cart-setting-open-orders-top').getAttribute('aria-selected')).toBe('false');
  fireEvent.click(screen.getByTestId('cart-setting-open-orders-top'));
  expect(onSettingsChange).toHaveBeenLastCalledWith({ sortLines: 'name', openOrdersPosition: 'top' });
});

const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

test('the open orders strip sits below the cart by default', () => {
  renderCart();
  const strip = screen.getByTestId('cart-open-orders');
  expect(strip.contains(screen.getByTestId('open-orders-node'))).toBe(true);
  expect(follows(screen.getByTestId('cart-head'), strip)).toBe(true);
});

test('a saved top puts the open orders strip above the cart head', () => {
  localStorage.setItem(CART_SETTINGS_KEY, '{"sortLines":"newest_top","openOrdersPosition":"top"}');
  renderCart();
  expect(follows(screen.getByTestId('cart-open-orders'), screen.getByTestId('cart-head'))).toBe(true);
});
