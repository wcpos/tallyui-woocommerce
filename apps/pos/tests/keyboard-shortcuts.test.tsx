import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen } from '../components/sale-screen';
import type { SaleScreenProps } from '../components/sale-screen';
import { Toaster } from '../components/toaster';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { dismissToast, getToasts } from '../lib/toast/toast';
import { ADDED_TO_CART_TOAST_ID } from '../lib/toast/added-to-cart-toast';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { noTaxSettings } from './fixtures/store-settings';
import { memoryStorage } from './memory-storage';

// WCPOS v2's alt+v `pos.cart.void` and alt+slash help sheet (hotkeys/bindings.ts:7-35, hotkeys/help-sheet.tsx:30-97,
// commands/commands.ts:13-46, en core.json pos_commands.*).

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1280, height: 800, scale: 1, fontScale: 1 });
  platform('Win32');
});

afterEach(() => {
  act(() => { for (const toast of getToasts()) dismissToast(toast.id); });
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function platform(value: string) {
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue(value);
}

const props: SaleScreenProps = {
  storeSettings: noTaxSettings,
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
};

const till = () => render(<><SaleScreen {...props} /><PortalHost /><Toaster /></>);
/** Adds a product and dismisses its Added to cart toast, so the void's toast is the one success toast. */
const add = (name: string) => { fireEvent.click(screen.getByText(name)); act(() => dismissToast(ADDED_TO_CART_TOAST_ID)); };
const line = (name: string) => screen.queryByLabelText(`Edit quantity of ${name}`);

/** Presses Alt+code on the document; returns defaultPrevented. */
async function press(code: string, key: string): Promise<boolean> {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, altKey: true, code, key });
  await act(async () => { document.dispatchEvent(event); });
  return event.defaultPrevented;
}
const pressV = () => press('KeyV', '√');
const openSheet = async () => {
  expect(await press('Slash', '÷')).toBe(true);
  return within(screen.getByTestId('hotkeys-help-sheet'));
};
const row = (id: string) => screen.getByTestId(`hotkeys-help-row-${id}`);
const disabled = (id: string) => row(id).getAttribute('aria-disabled') === 'true';

const IDS = ['pos.search.focus', 'pos.checkout.open', 'pos.cart.new', 'pos.cart.previous', 'pos.cart.next',
  'pos.cart.discount', 'pos.cart.void', 'pos.help.open'];
const LABELS = ['Search products', 'Checkout', 'New cart', 'Previous cart', 'Next cart', 'Add discount', 'Void order',
  'Keyboard shortcuts'];

test('alt+v voids a cart with lines and offers Undo; on a blank cart it does nothing', async () => {
  till();
  expect(await pressV()).toBe(false);
  expect(screen.queryByText('Order removed')).toBeNull();
  add('Espresso');
  expect(line('Espresso')).not.toBeNull();
  expect(await pressV()).toBe(true);
  expect(line('Espresso')).toBeNull();
  const toast = within(screen.getByTestId('success-toast'));
  expect(toast.getByText('Order removed')).not.toBeNull();
  fireEvent.click(screen.getByTestId('toast-action'));
  await waitFor(() => expect(line('Espresso')).not.toBeNull());
}, 20_000);

test("alt+/ opens the sheet with v2's eight rows in order and Alt keycaps off a Mac", async () => {
  till();
  const sheet = await openSheet();
  expect(sheet.getByTestId('hotkeys-help-title').textContent).toBe('Keyboard shortcuts');
  const rows = sheet.getAllByRole('button').filter(el => el.getAttribute('data-testid')?.startsWith('hotkeys-help-row-'));
  expect(rows.map(el => el.getAttribute('data-testid'))).toEqual(IDS.map(id => `hotkeys-help-row-${id}`));
  expect(rows.map(el => el.textContent)).toEqual(['AltF', 'AltP', 'AltN', 'Alt←', 'Alt→', 'AltD', 'AltV', 'Alt/']
    .map((caps, i) => LABELS[i] + caps));
}, 20_000);

test('on a Mac the keycaps read ⌥', async () => {
  platform('MacIntel');
  till();
  await openSheet();
  expect(row('pos.search.focus').textContent).toBe('Search products⌥F');
  expect(row('pos.cart.previous').textContent).toBe('Previous cart⌥←');
  expect(row('pos.help.open').textContent).toBe('Keyboard shortcuts⌥/');
}, 20_000);

test('on a blank cart Checkout, New cart, Add discount, Void order and the cart steps are disabled; search runs from its row', async () => {
  till();
  await openSheet();
  expect(IDS.filter(disabled)).toEqual(['pos.checkout.open', 'pos.cart.new', 'pos.cart.previous', 'pos.cart.next',
    'pos.cart.discount', 'pos.cart.void']);
  fireEvent.click(row('pos.search.focus'));
  expect(screen.queryByTestId('hotkeys-help-sheet')).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('catalogue-search')));
}, 20_000);

test('tapping Void order on a cart with lines closes the sheet and voids', async () => {
  till();
  add('Espresso');
  await openSheet();
  expect(IDS.filter(disabled)).toEqual(['pos.cart.previous', 'pos.cart.next']);
  fireEvent.click(row('pos.cart.void'));
  expect(screen.queryByTestId('hotkeys-help-sheet')).toBeNull();
  await waitFor(() => expect(line('Espresso')).toBeNull());
  expect(within(screen.getByTestId('success-toast')).getByText('Order removed')).not.toBeNull();
}, 20_000);

test('the Firefox note shows off a Mac only', async () => {
  till();
  await openSheet();
  expect(screen.getByTestId('hotkeys-help-firefox-note').textContent)
    .toBe('On Windows, Alt+F and Alt+D may also open the Firefox menu.');
  fireEvent.click(screen.getByTestId('hotkeys-help-close'));
  expect(screen.queryByTestId('hotkeys-help-sheet')).toBeNull();
  cleanup();
  platform('MacIntel');
  till();
  await openSheet();
  expect(screen.queryByTestId('hotkeys-help-firefox-note')).toBeNull();
}, 20_000);
