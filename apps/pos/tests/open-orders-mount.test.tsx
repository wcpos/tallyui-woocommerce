import { noTaxSettings } from './fixtures/store-settings';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { addRxPlugin, createRxDatabase } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen as SaleScreenWithoutHost } from '../components/sale-screen';
import type { SaleScreenProps } from '../components/sale-screen';
import { PANEL_SLIDE_OUT } from '../components/slide-over';
import { parkedCartSchema, parkedCartMigrationStrategies, type ParkedCartCollection } from '../lib/sale/parked-carts';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { openParkedList, parkedRow, parkedTabs } from './open-orders-helpers';
import { cartPane, openCartTab } from './phone-tabs-helpers';

// AUDIT 647: the strip's count cell slides WCPOS v2's open-orders list out of the strip over the cart beside it
// (v2 cart/tabs.tsx:462-481), in place of the ParkedSales dialog.

function SaleScreen(props: SaleScreenProps) {
  return <><SaleScreenWithoutHost {...props} /><PortalHost /></>;
}

const props: SaleScreenProps = {
  storeSettings: noTaxSettings,
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
};

addRxPlugin(RxDBMigrationSchemaPlugin);

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map([[CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })]]);
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

type Measured = Element & { __reactLayoutHandler: (event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void };
// RNW attaches onLayout to the node; jsdom has no ResizeObserver, so the test reports the strip wrapper's place in the pane.
function wrapperLayout(y: number, height: number) {
  act(() => { (screen.getByTestId('cart-open-orders') as unknown as Measured).__reactLayoutHandler({ nativeEvent: { layout: { x: 0, y, width: 400, height } } }); });
}

const cartBody = () => screen.getByTestId('cart-body');
const covered = () => cartBody().getAttribute('aria-hidden') === 'true' && cartBody().hasAttribute('inert');
const uncovered = () => cartBody().getAttribute('aria-hidden') !== 'true' && !cartBody().hasAttribute('inert');
const listGone = () => waitFor(() => expect(screen.queryByTestId('open-orders-list')).toBeNull());

/** Espresso parked with +, Cold Brew in the current cart. */
async function parkedAndCurrent() {
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  await act(async () => { fireEvent.click(screen.getByTestId('new-order-tab')); });
  fireEvent.click(screen.getByText('Cold Brew'));
  expect(parkedTabs()).toHaveLength(1);
}

test('the count opens the list over the cart and covers it; the count again closes it after the slide out', async () => {
  await parkedAndCurrent();
  expect(screen.queryByTestId('open-orders-cover')).toBeNull();
  expect(uncovered()).toBe(true);
  openParkedList();
  expect(within(screen.getByTestId('open-orders-cover')).getByTestId('open-orders-list')).not.toBeNull();
  expect(covered()).toBe(true);
  expect(screen.getByTestId('open-orders-count').getAttribute('aria-expanded')).toBe('true');
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  fireEvent.click(screen.getByTestId('open-orders-count'));
  expect(uncovered()).toBe(true);
  // Leaving, it stays mounted for the slide out, hidden from a screen reader.
  expect(screen.getByTestId('open-orders-list')).not.toBeNull();
  expect(screen.getByTestId('open-orders-cover-panel').getAttribute('aria-hidden')).toBe('true');
  act(() => { vi.advanceTimersByTime(PANEL_SLIDE_OUT); });
  expect(screen.queryByTestId('open-orders-list')).toBeNull();
  expect(screen.queryByTestId('open-orders-cover')).toBeNull();
  expect(uncovered()).toBe(true);
}, 20_000);

test('the frame covers the cart on the far side of the strip, at the bottom and at the top', async () => {
  await parkedAndCurrent();
  openParkedList();
  wrapperLayout(500, 52);
  const frame = () => screen.getByTestId('open-orders-cover').style;
  expect({ top: frame().top, height: frame().height, bottom: frame().bottom }).toEqual({ top: '0px', height: '500px', bottom: '' });
  fireEvent.click(screen.getByTestId('open-orders-count'));
  await listGone();

  fireEvent.click(screen.getByTestId('cart-settings-button'));
  fireEvent.click(screen.getByTestId('cart-setting-open-orders-top'));
  fireEvent.click(screen.getByTestId('ui-settings-close'));
  openParkedList();
  wrapperLayout(0, 52);
  expect({ top: frame().top, height: frame().height, bottom: frame().bottom }).toEqual({ top: '52px', height: '', bottom: '0px' });
}, 20_000);

test('every way out closes the list: a parked row, a strip tab, +, Close, and tender and back', async () => {
  await parkedAndCurrent();
  // A parked row resumes that cart and closes the list.
  openParkedList();
  await act(async () => { fireEvent.click(parkedRow()); });
  expect(uncovered()).toBe(true);
  await listGone();
  expect(screen.getByLabelText('Edit quantity of Espresso')).not.toBeNull();
  expect(screen.queryByLabelText('Edit quantity of Cold Brew')).toBeNull();

  // A strip tab closes it, and resumes its cart.
  openParkedList();
  expect(covered()).toBe(true);
  await act(async () => { fireEvent.click(parkedTabs()[0]); });
  expect(uncovered()).toBe(true);
  await listGone();
  await waitFor(() => expect(screen.getByLabelText('Edit quantity of Cold Brew')).not.toBeNull());

  // + closes it, and parks the current cart.
  openParkedList();
  await act(async () => { fireEvent.click(screen.getByTestId('new-order-tab')); });
  expect(uncovered()).toBe(true);
  await listGone();
  expect(parkedTabs()).toHaveLength(2);

  // Close closes it.
  fireEvent.click(screen.getByText('Espresso'));
  openParkedList();
  fireEvent.click(screen.getByTestId('open-orders-close'));
  expect(uncovered()).toBe(true);
  await listGone();

  // Leaving the cart stage closes it: back from the tender, the cart is not covered.
  openParkedList();
  expect(covered()).toBe(true);
  fireEvent.click(screen.getByTestId('cart-checkout'));
  expect(screen.queryByTestId('cart-body')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Back to cart' }));
  expect(screen.queryByTestId('open-orders-list')).toBeNull();
  expect(uncovered()).toBe(true);
  // The strip remounts with the cart; one press of the count opens it again (it was closed, not left open).
  openParkedList();
  expect(covered()).toBe(true);
}, 20_000);

test('the open cart\'s row closes the list and leaves the cart as it was', async () => {
  await parkedAndCurrent();
  openParkedList();
  const current = within(screen.getByTestId('open-orders-list')).getAllByRole('button')
    .find(row => row.getAttribute('data-testid')?.startsWith('open-orders-row-') && row !== parkedRow())!;
  await act(async () => { fireEvent.click(current); });
  expect(uncovered()).toBe(true);
  await listGone();
  expect(screen.getByLabelText('Edit quantity of Cold Brew')).not.toBeNull();
  expect(screen.queryByLabelText('Edit quantity of Espresso')).toBeNull();
  expect(parkedTabs()).toHaveLength(1);
}, 20_000);

test('a refused resume shows its message on the screen\'s message line, and the list closes', async () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 600, height: 800, scale: 1, fontScale: 1 });
  const db = await createRxDatabase({
    name: `parked_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
  });
  try {
    const { parked_carts: parkedCarts } = await db.addCollections<{ parked_carts: ParkedCartCollection }>({
      parked_carts: { schema: parkedCartSchema, migrationStrategies: parkedCartMigrationStrategies },
    });
    await parkedCarts.insert({
      id: crypto.randomUUID(), parkedAt: new Date().toISOString(), itemCount: 1, totalMinor: 300,
      lines: [{ productId: '80', variantId: '80', name: 'Espresso', quantity: 1, discounts: [] }], orderDiscounts: [],
    });
    render(<SaleScreen {...props} parkedCarts={parkedCarts} products={[]} status="syncing" />);
    openCartTab();
    await waitFor(() => expect(parkedTabs()).toHaveLength(1));
    openParkedList();
    await act(async () => { fireEvent.click(parkedRow()); });
    expect(await cartPane().findByText('The catalogue is still syncing. Try again in a moment.')).not.toBeNull();
    expect(uncovered()).toBe(true);
    await listGone();
    expect(await parkedCarts.find().exec()).toHaveLength(1);
  } finally {
    cleanup();
    await db.remove();
  }
}, 20_000);
