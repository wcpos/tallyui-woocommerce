import { noTaxSettings } from './fixtures/store-settings';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { addRxPlugin, createRxDatabase } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { Cart } from '@tallyui/components';
import * as TallyComponents from '@tallyui/components';
import { catalogueEntries, TaxProvider, useSale } from '@tallyui/pos';
import { SaleScreen as SaleScreenWithoutHost } from '../components/sale-screen';
import { PortalHost } from '@tallyui/primitives';
import type { SaleScreenProps } from '../components/sale-screen';
import { parkedCartSchema, parkedCartMigrationStrategies, type ParkedCartCollection } from '../lib/sale/parked-carts';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider } from '../lib/sale/outbox-context';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import variations from './fixtures/variations.json';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { openParkedList, parkedTabs } from './open-orders-helpers';
import { cartPane, cartTabCount, openCartTab, openProductsTab, paneShown, productsPane } from './phone-tabs-helpers';
import { SCAN_SOUND_KEY } from '../lib/scan/scan-sound';
import { installFakeAudio, tones } from './fake-audio-context';

function SaleScreen(props: SaleScreenProps) {
  return <><SaleScreenWithoutHost {...props} /><PortalHost /></>;
}

// The Cart sets no testID on a line. Each line sits in its own wrapper: the CartLine row first
// (Qty, Item, Price when the cart is wide enough, Total cells), then the line's actions, Increase <name> among them.
function queryCartItem(name: string): HTMLElement | null {
  // By its aria-label, not getByRole: a role query re-reads every button's name and is slow inside waitFor.
  let node: HTMLElement | null = screen.queryByLabelText(`Increase ${name}`);
  while (node && !(node.firstElementChild && within(node.firstElementChild as HTMLElement).queryByText(name))) node = node.parentElement;
  return node;
}

function cartItem(name: string): HTMLElement {
  const item = queryCartItem(name);
  if (!item) throw new Error(`No cart line for ${name}`);
  return item;
}

// Collapses whitespace as getByText's default normalizer does (Intl puts a no-break space in "KWD 2.501").
const text = (node: Element) => node.textContent!.replace(/\s+/g, ' ').trim();

// unitPrice is undefined when the Price column folds away (a narrow cart or a phone).
function queryCartLine(name: string): { quantity: string; unitPrice: string | undefined; total: string } | null {
  const row = queryCartItem(name)?.firstElementChild;
  if (!row) return null;
  const cells = Array.from(row.children);
  return {
    quantity: text(cells[0]),
    unitPrice: cells.length === 4 ? text(cells[2].lastElementChild!) : undefined,
    total: text(cells[cells.length - 1]),
  };
}

function cartLine(name: string) {
  const line = queryCartLine(name);
  if (!line) throw new Error(`No cart line for ${name}`);
  return line;
}

// The line's Price action has no role or label, only its text, and the Price column head reads the same.
function priceActions(): HTMLElement[] {
  return screen.queryAllByText('Price', { exact: true }).filter(node => !node.closest('[role="columnheader"]'));
}

function priceAction(name: string): HTMLElement {
  return within(cartItem(name)).getByText('Price', { exact: true });
}

// "Total" is also a cart column head; the summary row's label is the one outside the heads.
function summaryRow(label: string): HTMLElement {
  const labels = screen.getAllByText(label).filter(node => !node.closest('[role="columnheader"]'));
  expect(labels).toHaveLength(1);
  return labels[0].parentElement!;
}

addRxPlugin(RxDBMigrationSchemaPlugin);

const shirt = { ...products[2], variation_docs: variations.documents.filter(doc => doc.parent_id === products[2].id)
  .map(doc => ({ ...doc.payload, barcode: doc.payload.global_unique_id })) };

const props: SaleScreenProps = {
  storeSettings: noTaxSettings,
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
};

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 600, height: 800, scale: 1, fontScale: 1 });
});

// Browse by now opens on category tiles; these tests drive the flat product grid, so they browse All products.
beforeEach(() => {
  const data = new Map([[CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })]]);
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('barcode Enter adds Espresso, shows feedback and clears search', () => {
  render(<SaleScreen {...props} products={[products[0], products[1], shirt]} />);
  const input = screen.getByPlaceholderText('Search products') as HTMLInputElement;
  fireEvent.change(input, { target: { value: '2000000000015' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(cartTabCount()).toBe('1');
  expect(productsPane().getByText('Espresso added to cart')).not.toBeNull();
  expect(input.value).toBe('');
});

test('submitting the same barcode twice adds two items', () => {
  render(<SaleScreen {...props} products={[products[0], products[1], shirt]} />);
  const input = screen.getByPlaceholderText('Search products');
  for (let i = 0; i < 2; i++) {
    fireEvent.change(input, { target: { value: '2000000000015' } });
    fireEvent.keyDown(input, { key: 'Enter' });
  }
  expect(cartTabCount()).toBe('2');
});

test('a variation barcode adds the exact option without opening the chooser', () => {
  render(<SaleScreen {...props} products={[products[0], products[1], shirt]} />);
  const input = screen.getByPlaceholderText('Search products');
  fireEvent.change(input, { target: { value: '2000000000138' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.queryByText('Choose an option')).toBeNull();
  expect(productsPane().getByText('T-Shirt · S / Black added to cart')).not.toBeNull();
  expect(cartTabCount()).toBe('1');
});

test('a variable parent barcode opens the chooser without adding', () => {
  render(<SaleScreen {...props} products={[products[0], products[1], shirt]} />);
  const input = screen.getByPlaceholderText('Search products');
  fireEvent.change(input, { target: { value: '2000000000121' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.getByText('Choose an option')).not.toBeNull();
  expect(cartTabCount()).toBe('New');
});

test('an unknown barcode stays in search and reports no match', () => {
  render(<SaleScreen {...props} products={[products[0], products[1], shirt]} />);
  const input = screen.getByPlaceholderText('Search products') as HTMLInputElement;
  fireEvent.change(input, { target: { value: '999999999' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(productsPane().getByText('Barcode not found — 999999999')).not.toBeNull();
  expect(input.value).toBe('999999999');
  expect(cartTabCount()).toBe('New');
});

test('an out-of-stock barcode reports stock and adds nothing', () => {
  render(<SaleScreen {...props} products={[{ ...products[0], stock_status: 'outofstock', stock_quantity: 0 }]} />);
  const input = screen.getByPlaceholderText('Search products') as HTMLInputElement;
  fireEvent.change(input, { target: { value: '2000000000015' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(productsPane().getByText('Espresso out of stock')).not.toBeNull();
  expect(input.value).toBe('2000000000015');
  expect(cartTabCount()).toBe('New');
});

test('several barcode matches report the count and keep the code in search', () => {
  render(<SaleScreen {...props} products={[products[0], { ...products[0], id: 980, name: 'Espresso Twin' }]} />);
  const input = screen.getByPlaceholderText('Search products') as HTMLInputElement;
  fireEvent.change(input, { target: { value: '2000000000015' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(productsPane().getByText('Several matches: 2 products found — 2000000000015')).not.toBeNull();
  expect(input.value).toBe('2000000000015');
  expect(cartTabCount()).toBe('New');
});

function scanInto(input: HTMLElement, code: string) {
  fireEvent.change(input, { target: { value: code } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

test('with scan sound on, an added product plays success and a parent or unknown code plays failure', () => {
  installFakeAudio();
  localStorage.setItem(SCAN_SOUND_KEY, JSON.stringify({ enabled: true, theme: 'classic' }));
  render(<SaleScreen {...props} products={[products[0], products[1], shirt]} />);
  const input = screen.getByPlaceholderText('Search products');
  scanInto(input, '2000000000015');
  expect(productsPane().getByText('Espresso added to cart')).not.toBeNull();
  expect(tones()).toEqual(['sine 880', 'sine 1320']);
  installFakeAudio();
  scanInto(input, '999999999');
  expect(productsPane().getByText('Barcode not found — 999999999')).not.toBeNull();
  expect(tones()).toEqual(['square 330', 'square 220']);
  installFakeAudio();
  scanInto(input, '2000000000121');
  expect(screen.getByText('Choose an option')).not.toBeNull();
  expect(tones()).toEqual(['square 330', 'square 220']);
});

// useSale catches its own CartErrors, so onAdd returns false only for an error the cart rethrows: a price whose
// minor units overflow to Infinity makes the cart builder throw a RangeError.
test('with scan sound on, a scanned product the cart refuses plays failure, not success', () => {
  installFakeAudio();
  localStorage.setItem(SCAN_SOUND_KEY, JSON.stringify({ enabled: true, theme: 'classic' }));
  render(<SaleScreen {...props} products={[{ ...products[0], price: '1e307', regular_price: '1e307', on_sale: false }]} />);
  scanInto(screen.getByPlaceholderText('Search products'), '2000000000015');
  expect(productsPane().getByText('Price must be integer minor units')).not.toBeNull();
  expect(screen.queryByText('Espresso added to cart')).toBeNull();
  expect(tones()).toEqual(['square 330', 'square 220']);
});

test('with scan sound off, a scan plays nothing', () => {
  installFakeAudio();
  render(<SaleScreen {...props} products={[products[0], products[1], shirt]} />);
  const input = screen.getByPlaceholderText('Search products');
  scanInto(input, '2000000000015');
  scanInto(input, '999999999');
  expect(productsPane().getByText('Barcode not found — 999999999')).not.toBeNull();
  expect(tones()).toEqual([]);
});

test('a document wedge burst adds Espresso and shows feedback', () => {
  vi.useFakeTimers();
  try {
    render(<SaleScreen {...props} products={[products[0], products[1], shirt]} />);
    act(() => {
      for (const key of [...'2000000000015', 'Enter']) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        vi.advanceTimersByTime(5);
      }
    });
    expect(cartTabCount()).toBe('1');
    expect(productsPane().getByText('Espresso added to cart')).not.toBeNull();
  } finally {
    cleanup();
    vi.useRealTimers();
  }
});

test('narrow: adds, opens, changes quantity, removes and returns to products', () => {
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  expect(cartTabCount()).toBe('1');
  openCartTab();
  expect(cartPane().getByText('Espresso')).not.toBeNull();
  expect(paneShown('products')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  expect(cartLine('Espresso')).toEqual({ quantity: '2', unitPrice: undefined, total: '$6.00' });
  expect(within(screen.getByText('Subtotal').parentElement!).getByText('$6.00')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Espresso' }));
  expect(cartPane().queryByText('Espresso')).toBeNull();
  expect(screen.getByText('Scan or tap a product to start a sale.')).not.toBeNull();
  openProductsTab();
  expect(paneShown('products')).toBe(true);
  expect(screen.getByPlaceholderText('Search products')).not.toBeNull();
  expect(productsPane().getByText('Espresso')).not.toBeNull();
  expect(cartTabCount()).toBe('New');
});

test('variable products without options add nothing; adding a simple product clears the message', () => {
  render(<SaleScreen {...props} products={[products[0], { ...shirt, variation_docs: [] }]} />);
  fireEvent.click(screen.getByText('T-Shirt'));
  expect(productsPane().getByText('T-Shirt has no options to sell')).not.toBeNull();
  expect(cartTabCount()).toBe('New');
  fireEvent.click(screen.getByText('Espresso'));
  expect(screen.queryByText('T-Shirt has no options to sell')).toBeNull();
  expect(cartTabCount()).toBe('1');
});

test.each([600, 900])('variants at %spx: lists synced titles, prices and stock, then adds the selected variant', width => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
  render(<SaleScreen {...props} products={[shirt]} />);
  fireEvent.click(screen.getByText('T-Shirt'));
  for (const title of ['S / Black', 'S / White', 'M / Black']) {
    const option = screen.getByRole('button', { name: new RegExp(title) });
    expect(within(option).getByText(title)).not.toBeNull();
    expect(within(option).getByText('$25.00')).not.toBeNull();
    expect(within(option).getByText('In stock · 10')).not.toBeNull();
  }
  fireEvent.click(screen.getByRole('button', { name: /M \/ Black/ }));
  expect(screen.queryByText('Choose an option')).toBeNull();
  if (width < 900) openCartTab();
  expect(screen.getByText('T-Shirt · M / Black')).not.toBeNull();
  expect(cartLine('T-Shirt · M / Black')).toEqual({ quantity: '1', unitPrice: width < 900 ? undefined : '$25.00', total: '$25.00' });
  expect(within(screen.getByText('Subtotal').parentElement!).getByText('$25.00')).not.toBeNull();
});

test('one purchasable variant adds immediately', () => {
  render(<SaleScreen {...props} products={[{ ...shirt, variation_docs: shirt.variation_docs.slice(2) }]} />);
  fireEvent.click(screen.getByText('T-Shirt'));
  expect(screen.queryByText('Choose an option')).toBeNull();
  expect(cartTabCount()).toBe('1');
  openCartTab();
  expect(screen.getByText('T-Shirt · M / Black')).not.toBeNull();
});

test('cancelling the variant chooser adds nothing', () => {
  render(<SaleScreen {...props} products={[shirt]} />);
  fireEvent.click(screen.getByText('T-Shirt'));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByText('T-Shirt')).not.toBeNull();
  expect(cartTabCount()).toBe('New');
});

test('editing Espresso ×2 changes the unit price and subtotal exactly', () => {
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  openCartTab();
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  // Narrow: no Price column, so no price popover; the line's Price action opens the inline form.
  expect(screen.queryByLabelText('Edit price of Espresso')).toBeNull();
  fireEvent.click(priceAction('Espresso'));
  fireEvent.change(screen.getByRole('textbox', { name: 'Price value' }), { target: { value: '2.50' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(cartLine('Espresso')).toEqual({ quantity: '2', unitPrice: undefined, total: '$5.00' });
  expect(within(screen.getByText('Subtotal').parentElement!).getByText('$5.00')).not.toBeNull();
  expect(within(summaryRow('Total')).getByText('$5.00')).not.toBeNull();
});

test('invalid prices leave the form open and Cancel preserves the original price and total', () => {
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  openCartTab();
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(priceAction('Espresso'));
  for (const [value, message] of [
    ['', 'Enter a price.'], ['abc', 'Enter a number.'], ['-1', 'Enter a price of 0 or more.'],
    ['1.2.3', 'Enter a number.'], ['2.501', 'Use at most 2 decimal places.'],
    ['1e2', 'Enter a number.'], ['9007199254740992', 'Enter a number.'],
  ]) {
    fireEvent.change(screen.getByRole('textbox', { name: 'Price value' }), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('alert').textContent).toBe(message);
    expect(screen.getByRole('group', { name: 'Price for Espresso' })).not.toBeNull();
    expect(cartLine('Espresso')).toEqual({ quantity: '2', unitPrice: undefined, total: '$6.00' });
    expect(within(summaryRow('Total')).getByText('$6.00')).not.toBeNull();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(cartLine('Espresso')).toEqual({ quantity: '2', unitPrice: undefined, total: '$6.00' });
  expect(within(screen.getByText('Subtotal').parentElement!).getByText('$6.00')).not.toBeNull();
  expect(within(summaryRow('Total')).getByText('$6.00')).not.toBeNull();
}, 20_000);

test('parks through the sheet, shows the parked customer and restores them to the cart', async () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const gee = { id: '7', name: 'Gee Four', email: 'gee@example.invalid' };
  const customers = { search: vi.fn().mockResolvedValue([gee]), create: vi.fn().mockResolvedValue(gee) };
  render(<SaleScreen {...props} customers={customers} />);
  fireEvent.click(screen.getByTestId('cart-customer-name'));
  fireEvent.change(screen.getByPlaceholderText('Search Customers'), { target: { value: 'gee' } });
  fireEvent.click(await screen.findByLabelText('Gee Four, gee@example.invalid'));
  fireEvent.click(screen.getByText('Espresso'));
  openParkedList();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Park this sale' })); });
  const sheet = within(screen.getByTestId('parked-sales'));
  expect(sheet.getByText('Gee Four')).not.toBeNull();
  expect(sheet.getByText('1 item')).not.toBeNull();
  expect(sheet.getByText('$3.00')).not.toBeNull();
  await act(async () => { fireEvent.click(sheet.getByRole('button', { name: 'Resume parked sale' })); });
  expect(screen.queryByTestId('parked-sales')).toBeNull();
  expect(await screen.findByRole('button', { name: 'Customer: Gee Four' })).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Remove Espresso' })).not.toBeNull();
}, 20_000);

// D2: v2's default customer (use-default-customer-id.ts) is on every new cart, never on a resumed one.
test('a new sale starts with the default customer; a resumed one keeps its own, Guest included', async () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const gee = { id: '7', name: 'Gee Four', email: 'gee@example.invalid' };
  const anna = { id: '3', name: 'Anna Bell', email: 'anna@example.invalid' };
  const customers = { search: vi.fn().mockResolvedValue([anna]), create: vi.fn().mockResolvedValue(anna) };
  const chip = () => screen.getByTestId('cart-customer-name').getAttribute('aria-label');
  const view = render(<SaleScreen {...props} customers={customers} />);
  expect(chip()).toBe('Customer: Guest');
  // Resolved after mount: the idle first sale takes it.
  view.rerender(<SaleScreen {...props} customers={customers} defaultCustomer={gee} />);
  expect(chip()).toBe('Customer: Gee Four');
  // The cashier puts Guest on this sale, and parks it.
  fireEvent.click(screen.getByTestId('cart-customer-name'));
  await act(async () => { fireEvent.click(screen.getByTestId('customer-option-guest')); });
  fireEvent.click(screen.getByText('Espresso'));
  expect(chip()).toBe('Customer: Guest');
  await act(async () => { fireEvent.click(screen.getByTestId('new-order-tab')); });
  // The next new sale has the default again; the cashier changes it to Anna.
  expect(chip()).toBe('Customer: Gee Four');
  fireEvent.click(screen.getByTestId('cart-customer-name'));
  fireEvent.change(screen.getByPlaceholderText('Search Customers'), { target: { value: 'anna' } });
  fireEvent.click(await screen.findByLabelText('Anna Bell, anna@example.invalid'));
  fireEvent.click(screen.getByText('Cold Brew'));
  expect(chip()).toBe('Customer: Anna Bell');
  const resumeOnly = async (line: string) => {
    openParkedList();
    await act(async () => { fireEvent.click(within(screen.getByTestId('parked-sales')).getByRole('button', { name: 'Resume parked sale' })); });
    await waitFor(() => expect(screen.queryByRole('button', { name: `Remove ${line}` })).not.toBeNull());
  };
  // Resuming the Guest sale parks Anna's and restores Guest, not the default; resuming Anna's restores Anna.
  await resumeOnly('Espresso');
  expect(chip()).toBe('Customer: Guest');
  await resumeOnly('Cold Brew');
  expect(chip()).toBe('Customer: Anna Bell');
  expect(screen.queryByRole('button', { name: 'Remove Espresso' })).toBeNull();
}, 20_000);

test('with a Guest default every new sale is Guest, and a default resolved later reaches only an idle cart', async () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const gee = { id: '7', name: 'Gee Four' };
  const customers = { search: vi.fn().mockResolvedValue([]), create: vi.fn() };
  const chip = () => screen.getByTestId('cart-customer-name').getAttribute('aria-label');
  const view = render(<SaleScreen {...props} customers={customers} defaultCustomer={null} />);
  expect(chip()).toBe('Customer: Guest');
  fireEvent.click(screen.getByText('Espresso'));
  await act(async () => { fireEvent.click(screen.getByTestId('new-order-tab')); });
  expect(chip()).toBe('Customer: Guest');
  fireEvent.click(screen.getByText('Cold Brew'));
  // A cart with a line keeps its customer when the default changes; the next new sale takes it.
  view.rerender(<SaleScreen {...props} customers={customers} defaultCustomer={gee} />);
  expect(chip()).toBe('Customer: Guest');
  await act(async () => { fireEvent.click(screen.getByTestId('new-order-tab')); });
  expect(chip()).toBe('Customer: Gee Four');
}, 20_000);

// B7: v2's cells/price.tsx and cells/quantity-keypad.tsx. The popovers' keypad keys are `<kind>-popover-keypad-key-<name>`.
function typeOnKeypad(kind: 'price' | 'quantity', digits: string) {
  for (const key of digits) fireEvent.click(screen.getByTestId(`${kind}-popover-keypad-key-${key === '.' ? 'decimal' : key}`));
}

const popoverValue = (kind: 'price' | 'quantity') => text(screen.getByTestId(`${kind}-popover-value`));

test('wide: each line offers a price popover instead of the Price action, and keeps Discount', () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  render(<SaleScreen {...props} />);
  expect(screen.queryAllByTestId('price-popover-trigger')).toEqual([]);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByText('Cold Brew'));
  expect(priceActions()).toEqual([]);
  for (const name of ['Espresso', 'Cold Brew']) {
    const item = within(cartItem(name));
    expect(item.getAllByLabelText(`Edit price of ${name}`)).toHaveLength(1);
    expect(item.getAllByLabelText(`Edit quantity of ${name}`)).toHaveLength(1);
    expect(item.getAllByText('Discount', { exact: true })).toHaveLength(1);
    expect(item.queryByText('Price', { exact: true })).toBeNull();
  }
  fireEvent.click(screen.getByLabelText('Edit price of Cold Brew'));
  expect(within(screen.getByTestId('price-popover')).getByText('Price for Cold Brew')).not.toBeNull();
  fireEvent.click(screen.getByTestId('price-popover-cancel'));
  fireEvent.click(screen.getByRole('button', { name: 'Remove Cold Brew' }));
  expect(screen.getAllByTestId('price-popover-trigger')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Remove Espresso' }));
  expect(screen.queryAllByTestId('price-popover-trigger')).toEqual([]);
});

test('wide: the price popover shows the price and the −5%, −10% and −15% keys, and −10% applies 90%', () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(screen.getByLabelText('Edit price of Espresso'));
  const popover = within(screen.getByTestId('price-popover'));
  expect(popoverValue('price')).toBe('$3.00');
  expect(popover.getAllByTestId(/^price-discount-/).map(text)).toEqual(['−5%', '−10%', '−15%']);
  fireEvent.click(popover.getByTestId('price-discount-10'));
  expect(popoverValue('price')).toBe('$2.70');
  fireEvent.click(screen.getByTestId('price-popover-apply'));
  expect(screen.queryByTestId('price-popover')).toBeNull();
  expect(cartLine('Espresso')).toEqual({ quantity: '2', unitPrice: '$2.70', total: '$5.40' });
  expect(within(summaryRow('Total')).getByText('$5.40')).not.toBeNull();
});

test('wide: the quantity popover sets the quantity typed on its keypad and the line total follows', () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByLabelText('Edit quantity of Espresso'));
  expect(within(screen.getByTestId('quantity-popover')).getByText('Quantity for Espresso')).not.toBeNull();
  typeOnKeypad('quantity', '3');
  expect(popoverValue('quantity')).toBe('3');
  fireEvent.click(screen.getByTestId('quantity-popover-apply'));
  expect(screen.queryByTestId('quantity-popover')).toBeNull();
  expect(cartLine('Espresso')).toEqual({ quantity: '3', unitPrice: '$3.00', total: '$9.00' });
  expect(within(summaryRow('Total')).getByText('$9.00')).not.toBeNull();
});

test('wide: Cancel closes the price popover and writes nothing', () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByLabelText('Edit price of Espresso'));
  typeOnKeypad('price', '1');
  expect(popoverValue('price')).toBe('1');
  fireEvent.click(screen.getByTestId('price-popover-cancel'));
  expect(screen.queryByTestId('price-popover')).toBeNull();
  expect(cartLine('Espresso')).toEqual({ quantity: '1', unitPrice: '$3.00', total: '$3.00' });
  expect(within(summaryRow('Total')).getByText('$3.00')).not.toBeNull();
});

test('wide: a price the library refuses stays in the open popover and changes nothing', () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByLabelText('Edit price of Espresso'));
  typeOnKeypad('price', '9007199254740992');
  fireEvent.click(screen.getByTestId('price-popover-apply'));
  expect(within(screen.getByTestId('price-popover')).getByRole('alert').textContent).toBe('Enter a number.');
  expect(cartLine('Espresso')).toEqual({ quantity: '1', unitPrice: '$3.00', total: '$3.00' });
  expect(within(summaryRow('Total')).getByText('$3.00')).not.toBeNull();
});

test('narrow: Price actions appear once per line and none appear with an empty cart', () => {
  render(<SaleScreen {...props} />);
  expect(priceActions()).toEqual([]);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByText('Cold Brew'));
  openCartTab();
  expect(screen.queryAllByTestId('price-popover-trigger')).toEqual([]);
  expect(priceActions()).toHaveLength(2);
  expect(within(cartItem('Espresso')).getAllByText('Price', { exact: true })).toHaveLength(1);
  expect(within(cartItem('Cold Brew')).getAllByText('Price', { exact: true })).toHaveLength(1);
  // Cart Settings sorts newest at top by default (v2), so Cold Brew, added last, is the first line.
  fireEvent.click(priceActions()[0]);
  expect(screen.getByRole('group', { name: 'Price for Cold Brew' })).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove Cold Brew' }));
  expect(priceActions()).toEqual([priceAction('Espresso')]);
  fireEvent.click(screen.getByRole('button', { name: 'Remove Espresso' }));
  expect(priceActions()).toEqual([]);
});

// B1: v2's cart columns. The heads are the row that holds Qty, so a product table's heads never count.
function cartColumnHeads(): (string | null)[] {
  const row = screen.getByText('Qty', { exact: true }).closest('[role="row"]') as HTMLElement;
  return within(row).getAllByRole('columnheader').map(head => head.textContent);
}

test('the cart shows the Qty, Item, Price and Total column heads wide, and a phone folds Price away', () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const view = render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  expect(cartColumnHeads()).toEqual(['Qty', 'Item', 'Price', 'Total']);
  expect(cartLine('Espresso')).toEqual({ quantity: '1', unitPrice: '$3.00', total: '$3.00' });
  view.unmount();

  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  openCartTab();
  expect(cartColumnHeads()).toEqual(['Qty', 'Item', 'Total']);
  expect(screen.queryByRole('columnheader', { name: 'Price' })).toBeNull();
  expect(cartLine('Espresso')).toEqual({ quantity: '1', unitPrice: undefined, total: '$3.00' });
});

// The popover keypad cannot type past the currency's decimal places: JPY has no decimal key and ignores a typed ".",
// and KWD drops a fourth decimal.
test.each([
  ['JPY', '350', '¥350', '¥700', '350', '350'],
  ['KWD', '2.501', 'KWD 2.501', 'KWD 5.002', '2.5011', '2.501'],
])(
  'price edits respect the library decimal limit for %s', (currency, value, unit, total, invalid, typed) => {
    vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
    render(<SaleScreen {...props} currency={currency} />);
    fireEvent.click(screen.getByText('Espresso'));
    fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
    fireEvent.click(screen.getByLabelText('Edit price of Espresso'));
    typeOnKeypad('price', value);
    fireEvent.click(screen.getByTestId('price-popover-apply'));
    expect(screen.queryByTestId('price-popover')).toBeNull();
    expect(cartLine('Espresso')).toEqual({ quantity: '2', unitPrice: unit, total });
    expect(within(screen.getByText('Subtotal').parentElement!).getByText(total)).not.toBeNull();
    fireEvent.click(screen.getByLabelText('Edit price of Espresso'));
    if (currency === 'JPY') expect(screen.queryByTestId('price-popover-keypad-key-decimal')).toBeNull();
    typeOnKeypad('price', invalid);
    fireEvent.keyDown(document, { key: '.' });
    expect(popoverValue('price')).toBe(typed);
    fireEvent.click(screen.getByTestId('price-popover-apply'));
    expect(cartLine('Espresso')).toEqual({ quantity: '2', unitPrice: unit, total });
    expect(within(screen.getByText('Subtotal').parentElement!).getByText(total)).not.toBeNull();
  },
);

test('a real setUnitPrice refusal stays in the price popover without closing it', () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const { result } = renderHook(() => useSale({ currency: 'USD' }, { registerId: 'web', cashierRef: '2' }), {
    wrapper: ({ children }) => <TaxProvider ratesPpm={{}} pricesIncludeTax={false}>{children}</TaxProvider>,
  });
  act(() => result.current.add(catalogueEntries([products[0]], props.connector.traits.product, { currency: 'USD' })[0], props.connector.traits.product));
  const sale = result.current;
  act(() => result.current.newSale());
  render(<><Cart sale={sale} canEditPrice lineEditor="popover" /><PortalHost /></>);
  fireEvent.click(screen.getByLabelText('Edit price of Espresso'));
  typeOnKeypad('price', '2.5');
  fireEvent.click(screen.getByTestId('price-popover-apply'));
  const popover = screen.getByTestId('price-popover');
  expect(within(popover).getByRole('alert').textContent).toBe(`Unknown line ${sale.order.lineItems[0].id}`);
  expect(within(popover).getByTestId('price-popover-keypad')).not.toBeNull();
  expect(result.current.order.lineItems).toEqual([]);
});

test('wide: the grid and cart render together at 900px and Cold Brew costs $4.00', () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  render(<SaleScreen {...props} />);
  expect(screen.getByPlaceholderText('Search products')).not.toBeNull();
  expect(screen.getByText('Scan or tap a product to start a sale.')).not.toBeNull();
  // The phone tab bar is the narrow layout's alone.
  expect(screen.queryByTestId('pos-tab-bar')).toBeNull();
  fireEvent.click(screen.getByText('Cold Brew'));
  expect(screen.getAllByText('Cold Brew')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Remove Cold Brew' })).not.toBeNull();
  expect(within(screen.getByText('Subtotal').parentElement!).getByText('$4.00')).not.toBeNull();
});

test('wide: a tile counts its quantity in the cart and loses the badge when the line goes', () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  render(<SaleScreen {...props} />);
  expect(screen.queryByTestId('in-cart-tile-80')).toBeNull();
  fireEvent.click(screen.getByTestId('product-tile-80'));
  fireEvent.click(screen.getByTestId('product-tile-80'));
  expect(screen.getByTestId('in-cart-tile-80').textContent).toBe('2');
  fireEvent.click(screen.getByRole('button', { name: 'Remove Espresso' }));
  expect(screen.queryByTestId('in-cart-tile-80')).toBeNull();
});

test('with no order transport, Cash shows the payment placeholder and Back to cart keeps the cart', () => {
  const data = new Map<string, string>([[CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })]]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  });
  saveSession({
    site: { name: 'Store', home: 'https://shop.example', wpApiUrl: '', wcposApiUrl: '', authUrl: '' },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
  render(<SessionProvider><OutboxProvider transportFor={() => null}><SaleScreen {...props} /></OutboxProvider></SessionProvider>);
  fireEvent.click(screen.getByText('Espresso'));
  openCartTab();
  fireEvent.click(screen.getByTestId('cart-checkout'));
  expect(screen.getByText('Taking payment arrives in the next update')).not.toBeNull();
  expect(screen.queryByTestId('cart-checkout')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Back to cart' }));
  expect(screen.queryByText('Taking payment arrives in the next update')).toBeNull();
  expect(cartPane().getByText('Espresso')).not.toBeNull();
  expect(screen.getByTestId('cart-checkout')).not.toBeNull();
  expect(within(screen.getByText('Subtotal').parentElement!).getByText('$3.00')).not.toBeNull();
}, 20_000);

// Several full renders of the sale screen take longer than 5 s on the CI runner.
test('wide: parks, resumes while parking the current cart, and discards with confirmation', async () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  render(<SaleScreen {...props} />);
  expect(screen.getByTestId('new-order-tab').getAttribute('aria-selected')).toBe('true');
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  await act(async () => { fireEvent.click(screen.getByTestId('new-order-tab')); });
  expect(screen.getByText('Scan or tap a product to start a sale.')).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Remove Espresso' })).toBeNull();
  openParkedList();
  expect(screen.getByText('Parked sales')).not.toBeNull();
  expect(within(screen.getByTestId('parked-sales')).getByText('2 items')).not.toBeNull();
  expect(within(screen.getByTestId('parked-sales')).getByText('$6.00')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
  fireEvent.click(screen.getByText('Cold Brew'));
  openParkedList();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Resume parked sale' })); });
  expect(screen.queryByTestId('parked-sales')).toBeNull();
  expect(cartLine('Espresso')).toEqual({ quantity: '2', unitPrice: '$3.00', total: '$6.00' });
  expect(within(screen.getByText('Subtotal').parentElement!).getByText('$6.00')).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Remove Cold Brew' })).toBeNull();
  openParkedList();
  const sheet = within(screen.getByTestId('parked-sales'));
  expect(sheet.getByText('1 item')).not.toBeNull();
  expect(sheet.getByText('$4.00')).not.toBeNull();
  expect(sheet.queryByText('2 items')).toBeNull();
  fireEvent.click(sheet.getByRole('button', { name: 'Discard parked sale' }));
  expect(sheet.getByText('Discard this parked sale?')).not.toBeNull();
  expect(parkedTabs()).toHaveLength(1);
  await act(async () => { fireEvent.click(sheet.getByRole('button', { name: 'Discard' })); });
  expect(sheet.getByText('No parked sales.')).not.toBeNull();
  expect(parkedTabs()).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
  expect(cartLine('Espresso')).toEqual({ quantity: '2', unitPrice: '$3.00', total: '$6.00' });
}, 20_000);

// B12: no Parked (n) button on the products side; on the Cart tab the open-order strip reaches the parked list.
test('narrow: on the Cart tab the open-order strip opens the parked sheet and restores the cart', async () => {
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  openCartTab();
  await act(async () => { fireEvent.click(screen.getByTestId('new-order-tab')); });
  expect(cartTabCount()).toBe('New');
  expect(parkedTabs()).toHaveLength(1);
  openParkedList();
  expect(within(screen.getByTestId('parked-sales')).getByText('1 item')).not.toBeNull();
  expect(within(screen.getByTestId('parked-sales')).getByText('$3.00')).not.toBeNull();
  expect(paneShown('products')).toBe(false);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Resume parked sale' })); });
  expect(screen.queryByTestId('parked-sales')).toBeNull();
  expect(cartPane().getByText('Espresso')).not.toBeNull();
  expect(parkedTabs()).toHaveLength(0);
  expect(cartTabCount()).toBe('1');
  openProductsTab();
  expect(paneShown('cart')).toBe(false);
}, 20_000);

test('onResume resolves after restoration, and the sheet closes with the restored lines present', async () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const ParkedSales = TallyComponents.ParkedSales;
  let latest: Parameters<typeof ParkedSales>[0];
  const resumed = vi.fn();
  const closed = vi.fn();
  vi.spyOn(TallyComponents, 'ParkedSales').mockImplementation(sheetProps => {
    latest = sheetProps;
    return <ParkedSales {...sheetProps} onResume={async id => {
      const result = await sheetProps.onResume!(id);
      resumed(result, latest.sale.order.lineItems.map(({ name, quantity }) => ({ name, quantity })));
      return result;
    }} onOpenChange={open => {
      if (!open) closed(open, latest.sale.order.lineItems.map(({ name, quantity }) => ({ name, quantity })),
        queryCartLine('Espresso'), queryCartLine('Cold Brew'));
      sheetProps.onOpenChange(open);
    }} />;
  });
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(screen.getByText('Cold Brew'));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Cold Brew' }));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Cold Brew' }));
  await act(async () => { fireEvent.click(screen.getByTestId('new-order-tab')); });
  openParkedList();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Resume parked sale' }));
    await Promise.resolve();
    expect(resumed).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
    expect(latest.open).toBe(true);
  });
  const lines = [{ name: 'Espresso', quantity: 2 }, { name: 'Cold Brew', quantity: 3 }];
  expect(resumed).toHaveBeenCalledExactlyOnceWith(null, lines);
  const espresso = { quantity: '2', unitPrice: '$3.00', total: '$6.00' };
  const coldBrew = { quantity: '3', unitPrice: '$4.00', total: '$12.00' };
  expect(closed).toHaveBeenCalledExactlyOnceWith(false, lines, espresso, coldBrew);
  expect(latest!.open).toBe(false);
  expect(screen.queryByTestId('parked-sales')).toBeNull();
  expect(cartLine('Espresso')).toEqual(espresso);
  expect(cartLine('Cold Brew')).toEqual(coldBrew);
}, 20_000);

test('resuming reports a missing product in the phone cart message line', async () => {
  const view = render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  openCartTab();
  await act(async () => { fireEvent.click(screen.getByTestId('new-order-tab')); });
  view.rerender(<SaleScreen {...props} products={products.slice(1)} />);
  openParkedList();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Resume parked sale' })); });
  expect(screen.queryByTestId('parked-sales')).toBeNull();
  expect(cartPane().getByText('Espresso is no longer in the catalogue.')).not.toBeNull();
  expect(screen.getByText('Scan or tap a product to start a sale.')).not.toBeNull();
}, 20_000);

test('a failed park from + shows the error and keeps the cart line', async () => {
  const db = await createRxDatabase({
    name: `parked_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
  });
  try {
    const { parked_carts: parkedCarts } = await db.addCollections<{ parked_carts: ParkedCartCollection }>({
      parked_carts: { schema: parkedCartSchema, migrationStrategies: parkedCartMigrationStrategies },
    });
    vi.spyOn(parkedCarts, 'insert').mockRejectedValue(new Error('disk full'));
    render(<SaleScreen {...props} parkedCarts={parkedCarts} />);
    fireEvent.click(screen.getByText('Espresso'));
    openCartTab();
    await act(async () => { fireEvent.click(screen.getByTestId('new-order-tab')); });
    expect(await cartPane().findByText('disk full')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Remove Espresso' })).not.toBeNull();
    expect(cartLine('Espresso')).toEqual({ quantity: '1', unitPrice: undefined, total: '$3.00' });
  } finally {
    cleanup();
    await db.remove();
  }
});

test('a parked cart stays parked while syncing and resumes once the catalogue is ready', async () => {
  const db = await createRxDatabase({
    name: `parked_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
  });
  try {
    const { parked_carts: parkedCarts } = await db.addCollections<{ parked_carts: ParkedCartCollection }>({
      parked_carts: { schema: parkedCartSchema, migrationStrategies: parkedCartMigrationStrategies },
    });
    const cart = await parkedCarts.insert({
      id: crypto.randomUUID(), parkedAt: new Date().toISOString(), itemCount: 2, totalMinor: 600,
      lines: [{ productId: '80', variantId: '80', name: 'Espresso', quantity: 2, discounts: [] }], orderDiscounts: [],
    });
    const view = render(<SaleScreen {...props} parkedCarts={parkedCarts} products={[]} status="syncing" />);
    openCartTab();
    await waitFor(() => expect(parkedTabs()).toHaveLength(1));
    openParkedList();
    fireEvent.click(screen.getByRole('button', { name: 'Resume parked sale' }));
    expect(await within(screen.getByTestId('parked-sales')).findByText(
      'The catalogue is still syncing. Try again in a moment.',
    )).not.toBeNull();
    expect((await parkedCarts.find().exec()).map(doc => doc.toJSON())).toEqual([cart.toJSON()]);
    expect(screen.getByText('Scan or tap a product to start a sale.')).not.toBeNull();

    view.rerender(<SaleScreen {...props} parkedCarts={parkedCarts} status="ready" />);
    fireEvent.click(screen.getByRole('button', { name: 'Resume parked sale' }));
    await waitFor(() => expect(cartLine('Espresso')).toEqual({ quantity: '2', unitPrice: undefined, total: '$6.00' }));
    await waitFor(() => expect(screen.queryByTestId('parked-sales')).toBeNull());
    expect(await parkedCarts.find().exec()).toEqual([]);
    expect(screen.getByRole('button', { name: 'Remove Espresso' })).not.toBeNull();
  } finally {
    cleanup();
    await db.remove();
  }
}, 20_000);

test('persisted carts survive a new screen, restore, swap and discard', async () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const db = await createRxDatabase({
    name: `parked_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
  });
  try {
    const { parked_carts: parkedCarts } = await db.addCollections<{ parked_carts: ParkedCartCollection }>({
      parked_carts: { schema: parkedCartSchema, migrationStrategies: parkedCartMigrationStrategies },
    });
    const view = render(<SaleScreen {...props} parkedCarts={parkedCarts} />);
    fireEvent.click(screen.getByText('Espresso'));
    fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
    await act(async () => { fireEvent.click(screen.getByTestId('new-order-tab')); });
    await waitFor(() => expect(parkedTabs()).toHaveLength(1));
    const docs = await parkedCarts.find().exec();
    expect(docs).toHaveLength(1);
    expect(docs[0].toJSON()).toMatchObject({
      itemCount: 2, totalMinor: 600, lines: [{ productId: '80', name: 'Espresso', quantity: 2 }],
    });
    view.unmount();
    render(<SaleScreen {...props} parkedCarts={parkedCarts} />);
    await waitFor(() => expect(parkedTabs()).toHaveLength(1));
    openParkedList();
    expect(within(screen.getByTestId('parked-sales')).getByText('2 items')).not.toBeNull();
    expect(within(screen.getByTestId('parked-sales')).getByText('$6.00')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Resume parked sale' }));
    await waitFor(() => expect(cartLine('Espresso')).toEqual({ quantity: '2', unitPrice: '$3.00', total: '$6.00' }));
    await waitFor(() => expect(screen.queryByTestId('parked-sales')).toBeNull());
    expect(await parkedCarts.find().exec()).toEqual([]);
    expect(screen.getByRole('button', { name: 'Remove Espresso' })).not.toBeNull();

    await act(async () => { fireEvent.click(screen.getByTestId('new-order-tab')); });
    await waitFor(() => expect(parkedTabs()).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove Espresso' })).toBeNull());
    fireEvent.click(screen.getByText('Cold Brew'));
    openParkedList();
    fireEvent.click(screen.getByRole('button', { name: 'Resume parked sale' }));
    await waitFor(() => expect(cartLine('Espresso')).toEqual({ quantity: '2', unitPrice: '$3.00', total: '$6.00' }));
    await waitFor(() => expect(screen.queryByTestId('parked-sales')).toBeNull());
    await waitFor(() => expect(parkedTabs()).toHaveLength(1));
    const swapped = await parkedCarts.find().exec();
    expect(swapped).toHaveLength(1);
    expect(swapped[0].toJSON()).toMatchObject({ itemCount: 1, totalMinor: 400, lines: [{ name: 'Cold Brew' }] });
    openParkedList();
    expect(within(screen.getByTestId('parked-sales')).getByText('1 item')).not.toBeNull();
    expect(within(screen.getByTestId('parked-sales')).getByText('$4.00')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Discard parked sale' }));
    expect(screen.getByText('Discard this parked sale?')).not.toBeNull();
    expect(await parkedCarts.find().exec()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await screen.findByText('No parked sales.');
    expect(await parkedCarts.find().exec()).toEqual([]);
  } finally {
    cleanup();
    await db.remove();
  }
}, 20_000);

// A12/B12: the phone till's Products / Cart tab bar (v2 pos-phone-tab-bar.tsx), both panes mounted.
const phone = () => vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });

test('phone: the tab bar replaces Back to products, Parked (n) and the cart bar', () => {
  phone();
  render(<SaleScreen {...props} />);
  expect(screen.getByTestId('pos-tab-bar')).not.toBeNull();
  expect(screen.getByTestId('pos-tab-products').getAttribute('aria-selected')).toBe('true');
  expect(screen.queryByRole('button', { name: 'Back to products' })).toBeNull();
  expect(screen.queryByRole('button', { name: /^Parked \(/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /^(Cart is empty|Open cart)/ })).toBeNull();
  openCartTab();
  expect(screen.queryByRole('button', { name: 'Back to products' })).toBeNull();
});

test('phone: adding two of a product makes the Cart badge 2', () => {
  phone();
  render(<SaleScreen {...props} />);
  expect(cartTabCount()).toBe('New');
  fireEvent.click(screen.getByTestId('product-tile-80'));
  fireEvent.click(screen.getByTestId('product-tile-80'));
  expect(cartTabCount()).toBe('2');
  expect(screen.getByRole('tab', { name: 'Cart, 2' })).not.toBeNull();
});

test('phone: the tabs swap the panes, hiding the other with display none', () => {
  phone();
  render(<SaleScreen {...props} />);
  expect([paneShown('products'), paneShown('cart')]).toEqual([true, false]);
  openCartTab();
  expect([paneShown('products'), paneShown('cart')]).toEqual([false, true]);
  expect(screen.getByTestId('pos-tab-cart').getAttribute('aria-selected')).toBe('true');
  expect(screen.getByTestId('pos-tab-products').getAttribute('aria-selected')).toBe('false');
  openProductsTab();
  expect([paneShown('products'), paneShown('cart')]).toEqual([true, false]);
  expect(screen.getByTestId('pos-tab-products').getAttribute('aria-selected')).toBe('true');
});

test('phone: a wedge scan on the Cart tab still adds, since the products pane stays mounted (v2 #1438)', () => {
  phone();
  vi.useFakeTimers();
  try {
    render(<SaleScreen {...props} products={[products[0], products[1], shirt]} />);
    openCartTab();
    act(() => {
      for (const key of [...'2000000000015', 'Enter']) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        vi.advanceTimersByTime(5);
      }
    });
    expect(paneShown('cart')).toBe(true);
    expect(cartTabCount()).toBe('1');
    expect(cartLine('Espresso')).toEqual({ quantity: '1', unitPrice: undefined, total: '$3.00' });
  } finally {
    cleanup();
    vi.useRealTimers();
  }
});

test('phone: on the Cart tab the open-order strip resumes a parked cart', async () => {
  phone();
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  openCartTab();
  await act(async () => { fireEvent.click(screen.getByTestId('new-order-tab')); });
  expect(cartTabCount()).toBe('New');
  expect(parkedTabs()).toHaveLength(1);
  await act(async () => { fireEvent.click(parkedTabs()[0]); });
  expect(parkedTabs()).toHaveLength(0);
  expect(cartTabCount()).toBe('1');
  expect(cartLine('Espresso')).toEqual({ quantity: '1', unitPrice: undefined, total: '$3.00' });
}, 20_000);
