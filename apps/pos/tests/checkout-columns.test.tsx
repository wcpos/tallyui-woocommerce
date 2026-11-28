import { setLineQuantity } from './cart-line-helpers';
import { noTaxSettings } from './fixtures/store-settings';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { OrderCreateEnvelope } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { OnlineStatusContext } from '../lib/online/online-status';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import type { TenderVoidCollection } from '../lib/sale/tender-voids';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeLeg } from './tender-helpers';

// Design memo spec 2 (amended 23 Nov): at 900 and up the tender takes the products column, and the cart column shows the
// stilled order (the app's read-only lines) above the app's closing ledger.
let orders: (ReturnType<typeof useOutbox> & { enabled: true })['orders'];
let voids: TenderVoidCollection;

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  });
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000, user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function OrderStoreReady() {
  const outbox = useOutbox();
  if (!outbox.enabled || !outbox.orders) return null;
  orders = outbox.orders;
  voids = outbox.orders.database.collections.tender_voids as TenderVoidCollection;
  return <span>Order store ready</span>;
}

/** Two Espresso ($6.00) and a Cold Brew ($4.00), then Checkout. */
async function checkout({ multi = true, width = 1024, position = 'left', offline = false } = {}) {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all', position }));
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({ kind: 'results',
    results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 1000 } })) }));
  render(
    <OnlineStatusContext.Provider value={{ status: offline ? 'offline' : 'online-website-available' }}>
      <SessionProvider>
        <OutboxProvider transportFor={() => ({ send })} storage={getRxStorageMemory()}>
          <OrderStoreReady />
          <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
            storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}} multiplePayments={multi} />
          <PortalHost />
        </OutboxProvider>
      </SessionProvider>
    </OnlineStatusContext.Provider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByText('Cold Brew'));
  setLineQuantity('Espresso', 2);
  if (width >= 900) expect(within(screen.getByTestId('pos-cart-panel')).queryAllByTestId('quantity-popover-trigger')).toHaveLength(2);
  fireEvent.click(screen.getByTestId('cart-checkout'));
}

const cart = () => within(screen.getByTestId('pos-cart-panel'));
const follows = (first: HTMLElement, second: HTMLElement) => !!(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

test.each([true, false])('1. the tender takes the products column and the catalogue goes (multi %s)', async multi => {
  await checkout({ multi });
  const products = within(screen.getByTestId('pos-products-panel'));
  expect(products.getByTestId('checkout-title-bar')).not.toBeNull();
  expect(products.getByTestId('checkout-tender')).not.toBeNull();
  expect(cart().queryByTestId('checkout-tender')).toBeNull();
  expect(screen.queryByTestId('pos-products-column')).toBeNull();
  expect(screen.queryByTestId('catalogue-search')).toBeNull();
}, 20_000);

test.each([true, false])('2. the cart column lists every line read-only (multi %s)', async multi => {
  await checkout({ multi });
  const rows = within(cart().getByTestId('checkout-order-lines')).getAllByTestId(/^checkout-order-line-/);
  expect(rows.map(row => row.textContent)).toEqual([expect.stringContaining('Espresso'), expect.stringContaining('Cold Brew')]);
  expect(rows[0].textContent).toContain('× 2');
  expect(rows[0].textContent).toContain('$6.00');
  expect(rows[1].textContent).not.toContain('×');
  expect(rows[1].textContent).toContain('$4.00');
  expect(cart().queryAllByTestId('quantity-popover-trigger')).toHaveLength(0);
  expect(cart().queryAllByTestId('price-popover-trigger')).toHaveLength(0);
  expect(cart().queryByText(/Order discount/)).toBeNull();
  expect(cart().queryByLabelText(/Edit quantity of|Edit price of/)).toBeNull();
}, 20_000);

test.each([true, false])('3. the cart column shows No payments yet and the Total (multi %s)', async multi => {
  await checkout({ multi });
  expect(cart().getByTestId('checkout-ledger-empty').textContent).toBe('No payments yet');
  expect(cart().getByTestId('checkout-order-total').textContent).toBe('$10.00');
  expect(follows(cart().getByTestId('checkout-order-lines'), cart().getByTestId('checkout-ledger-pane'))).toBe(true);
}, 20_000);

test('3. after one leg the cart column shows the leg, then Total, Paid and Remaining', async () => {
  await checkout();
  takeLeg(200);
  const leg = await cart().findByTestId(/^checkout-leg-/);
  const [total, paid, remaining] = ['checkout-order-total', 'checkout-ledger-paid', 'checkout-ledger-remaining'].map(id => cart().getByTestId(id));
  expect([total, paid, remaining].map(el => el.textContent)).toEqual(['$10.00', '$2.00', '$8.00']);
  expect(follows(leg, total) && follows(total, paid) && follows(paid, remaining)).toBe(true);
}, 20_000);

test('4. a card leg reads Card in the cart column ledger', async () => {
  await checkout();
  takeLeg(300, 'pos_card');
  expect((await cart().findByTestId(/^checkout-leg-/)).textContent).toContain('Card');
}, 20_000);

test('5. Remove in the cart column journals one void before the leg leaves the sale', async () => {
  await checkout();
  takeLeg(200);
  const legStillShown: boolean[] = [];
  const insert = voids.bulkInsert.bind(voids);
  vi.spyOn(voids, 'bulkInsert').mockImplementation(async rows => {
    legStillShown.push(cart().getByTestId(/^checkout-status-leg-/).textContent !== 'Voided');
    return insert(rows);
  });
  fireEvent.click(await cart().findByTestId(/^checkout-remove-leg-/));
  await waitFor(() => expect(cart().getByTestId(/^checkout-status-leg-/).textContent).toBe('Voided'));
  expect(legStillShown).toEqual([true]);
  expect((await voids.find().exec()).map(row => row.reason)).toEqual(['removed']);
}, 20_000);

test('6. no Remove while the sale saves', async () => {
  await checkout();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const insert = orders!.insert.bind(orders!);
  vi.spyOn(orders!, 'insert').mockImplementationOnce(async doc => { await gate; return insert(doc); });
  takeLeg(200);
  expect(await cart().findByTestId(/^checkout-remove-leg-/)).not.toBeNull();
  takeLeg(800);
  await waitFor(() => expect(screen.getByTestId('checkout-commit').textContent).toBe('Saving order…'));
  expect(cart().queryAllByTestId(/^checkout-leg-/)).toHaveLength(2);
  expect(cart().queryAllByTestId(/^checkout-remove-leg-/)).toHaveLength(0);
  release();
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
}, 20_000);

test('6. no Remove while the cancel question is open', async () => {
  await checkout();
  takeLeg(200);
  expect(await cart().findByTestId(/^checkout-remove-leg-/)).not.toBeNull();
  fireEvent.click(screen.getByTestId('checkout-close'));
  expect(within(screen.getByTestId('pos-products-panel')).getByTestId('cancel-payment')).not.toBeNull();
  expect(cart().queryAllByTestId(/^checkout-leg-/)).toHaveLength(1);
  expect(cart().queryAllByTestId(/^checkout-remove-leg-/)).toHaveLength(0);
}, 20_000);

test.each([true, false])('7. with Products on the right the tender is on the right (multi %s)', async multi => {
  await checkout({ multi, position: 'right' });
  expect(follows(screen.getByTestId('pos-cart-panel'), screen.getByTestId('pos-products-panel'))).toBe(true);
  expect(within(screen.getByTestId('pos-products-panel')).getByTestId('checkout-tender')).not.toBeNull();
}, 20_000);

test('8. there is no checkout-ledger-column', async () => {
  await checkout();
  takeLeg(200);
  await cart().findByTestId(/^checkout-leg-/);
  expect(screen.queryByTestId('checkout-ledger-column')).toBeNull();
}, 20_000);

test('9. a leg taken offline shows the offline line under the tender', async () => {
  await checkout({ offline: true });
  takeLeg(200);
  fireEvent.click(await screen.findByTestId('checkout-offline-confirm'));
  const line = await within(screen.getByTestId('pos-products-panel')).findByTestId('checkout-offline-legs');
  expect(line.textContent).toBe('1 payment recorded offline');
  expect(follows(screen.getByTestId('checkout-tender'), line)).toBe(true);
}, 20_000);

test('10. at 390 the tender has the app ledger under it, as before', async () => {
  await checkout({ width: 390 });
  const scroll = within(screen.getByTestId('checkout-scroll'));
  expect(follows(scroll.getByTestId('checkout-tender'), scroll.getByTestId('checkout-ledger-pane'))).toBe(true);
  expect(screen.queryByTestId('checkout-order-lines')).toBeNull();
  expect(screen.queryByTestId('checkout-offline-legs')).toBeNull();
}, 20_000);
