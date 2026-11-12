import { setLineQuantity } from './cart-line-helpers';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { addRxPlugin, createRxDatabase } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { OrderCreateEnvelope } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen, type SaleScreenProps } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { RegisterProvider, useRegister } from '../lib/register/register-context';
import { parkedCartSchema, parkedCartMigrationStrategies, type ParkedCartCollection } from '../lib/sale/parked-carts';
import { runBeforeLeave, setBeforeLeave } from '../lib/sale/before-leave';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { noTaxSettings } from './fixtures/store-settings';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeLeg } from './tender-helpers';
import { parkedTabs } from './open-orders-helpers';
import { sessionsOff } from './cart-head-helpers';

// The register's column wraps the cart in a layout this harness doesn't need (as in register-session.test.tsx).
vi.mock('@tallyui/components', async importOriginal => ({
  ...await importOriginal<typeof import('@tallyui/components')>(),
  RegisterColumn: ({ children }: { children: import('react').ReactNode }) => children,
}));

addRxPlugin(RxDBMigrationSchemaPlugin);

const props: SaleScreenProps = {
  storeSettings: noTaxSettings,
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
};

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>([[CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })]]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  });
  sessionsOff();
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
});

afterEach(() => {
  setBeforeLeave(null);
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

/** A till with an order store (and a register, off), one payment per order unless `multiplePayments`. */
async function renderTill(multiplePayments?: boolean) {
  let register!: ReturnType<typeof useRegister>;
  function Probe() { register = useRegister(); return null; }
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({
    kind: 'results',
    results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 600 } })),
  }));
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => ({ send })} storage={getRxStorageMemory()}>
        <RegisterProvider>
          <Probe />
          <OrderStoreReady />
          <SaleScreen {...props} multiplePayments={multiplePayments} />
          <PortalHost />
        </RegisterProvider>
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  await waitFor(() => expect(register.boundRegisterId).not.toBeNull());
  return { send, get register() { return register; } };
}

async function withParkedCarts(run: (parkedCarts: ParkedCartCollection) => Promise<void>) {
  const db = await createRxDatabase({
    name: `cart_foot_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
  });
  try {
    const { parked_carts: parkedCarts } = await db.addCollections<{ parked_carts: ParkedCartCollection }>({
      parked_carts: { schema: parkedCartSchema, migrationStrategies: parkedCartMigrationStrategies },
    });
    await run(parkedCarts);
  } finally {
    cleanup();
    await db.remove();
  }
}

const checkoutButton = () => screen.getByTestId('cart-checkout');
const text = (testId: string) => screen.getByTestId(testId).textContent;

async function sentPayments(send: Awaited<ReturnType<typeof renderTill>>['send']) {
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  return send.mock.calls[0][0][0].payload.payments;
}

function chooseVoid() {
  fireEvent.click(screen.getByTestId('cart-foot-more'));
  const menu = screen.getByTestId('cart-foot-menu');
  expect(within(menu).queryByRole('menuitem', { name: 'Void' })).toBeNull();
  fireEvent.click(within(menu).getByRole('menuitem', { name: 'Order details' }));
  fireEvent.click(screen.getByTestId('order-details-void'));
}

test('(a) the foot reads Checkout with the cart total, is absent while empty, and has no Cash or Card terminal buttons', () => {
  render(<><SaleScreen {...props} /><PortalHost /></>);
  expect(screen.queryByTestId('cart-checkout')).toBeNull();
  fireEvent.click(screen.getByText('Espresso'));
  setLineQuantity('Espresso', 2);
  fireEvent.click(screen.getByText('Cold Brew'));
  const footer = within(screen.getByTestId('cart-footer'));
  const total = within(footer.getByText('Total').parentElement!).getByText('$10.00').textContent;
  expect(checkoutButton().textContent).toBe(`Checkout ${total}`);
  expect(checkoutButton().getAttribute('aria-disabled')).not.toBe('true');
  expect(screen.queryByRole('button', { name: 'Cash' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Card terminal' })).toBeNull();
}, 20_000);

test('(b) Checkout opens the tender on Cash, and picking Card there takes a card sale', async () => {
  const { send } = await renderTill(false);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(checkoutButton());
  await screen.findByTestId('checkout-keypad');
  expect(screen.getByTestId('checkout-method-pos_cash').getAttribute('aria-selected')).toBe('true');
  expect(text('checkout-commit')).toBe('Take $3.00 in Cash');
  fireEvent.click(screen.getByTestId('checkout-method-pos_card'));
  expect(text('checkout-commit')).toBe('Take $3.00 in Card');
  fireEvent.click(screen.getByTestId('checkout-commit'));
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
  expect(await sentPayments(send)).toEqual([expect.objectContaining({ method: 'external', amountMinor: 300 })]);
}, 20_000);

test('(c) with the register on and no session open, Checkout asks to open the register and stays on the cart', async () => {
  const app = await renderTill(false);
  act(() => app.register.setSetting(true));
  expect(app.register.enabled).toBe(true);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(checkoutButton());
  expect(await screen.findByText('Open the register to take payment.')).not.toBeNull();
  expect(checkoutButton()).not.toBeNull();
  expect(screen.getByLabelText('Edit quantity of Espresso')).not.toBeNull();
  expect(screen.queryByTestId('checkout-keypad')).toBeNull();
  expect(app.send).not.toHaveBeenCalled();
}, 20_000);

test('(d) multi-payment: Checkout opens with nothing taken, then a Cash leg and a Card leg pay it off', async () => {
  const { send } = await renderTill(true);
  fireEvent.click(screen.getByText('Espresso'));
  setLineQuantity('Espresso', 2);
  fireEvent.click(checkoutButton());
  expect(await screen.findByTestId('checkout-ledger')).not.toBeNull();
  expect(text('checkout-ledger-empty')).toBe('No payments yet');
  expect(text('checkout-ledger-totals')).toBe('Total$6.00Paid$0.00Remaining$6.00');
  expect(screen.getByTestId('checkout-method-pos_cash').getAttribute('aria-selected')).toBe('true');
  expect(text('checkout-commit')).toBe('Take $6.00 in Cash');
  takeLeg(200);
  expect(text('checkout-ledger-remaining')).toBe('$4.00');
  takeLeg(400, 'pos_card');
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
  expect(await sentPayments(send)).toEqual([
    expect.objectContaining({ method: 'cash', amountMinor: 200 }),
    expect.objectContaining({ method: 'external', amountMinor: 400 }),
  ]);
}, 20_000);

test('(e) Void asks first: Keep sale keeps every line', () => {
  render(<><SaleScreen {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByText('Espresso'));
  setLineQuantity('Espresso', 2);
  fireEvent.click(screen.getByText('Cold Brew'));
  chooseVoid();
  expect(screen.getByText('Void this sale?')).not.toBeNull();
  expect(screen.getByText("Its items are removed. This can't be undone.")).not.toBeNull();
  expect(screen.getByLabelText('Edit quantity of Espresso')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Keep sale' }));
  expect(screen.queryByText('Void this sale?')).toBeNull();
  expect(screen.getByLabelText('Edit quantity of Espresso')).not.toBeNull();
  expect(screen.getByLabelText('Edit quantity of Cold Brew')).not.toBeNull();
  expect(checkoutButton().textContent).toBe('Checkout $10.00');
}, 20_000);

test('(e) Void sale empties the cart, and it stays empty through the persisted-cart path', async () => {
  await withParkedCarts(async parkedCarts => {
    const view = render(<><SaleScreen {...props} parkedCarts={parkedCarts} heldCartKey="held-test" /><PortalHost /></>);
    fireEvent.click(screen.getByText('Espresso'));
    fireEvent.click(screen.getByText('Cold Brew'));
    chooseVoid();
    fireEvent.click(screen.getByRole('button', { name: 'Void sale' }));
    await waitFor(() => expect(screen.queryByText('Void this sale?')).toBeNull());
    expect(screen.queryByLabelText('Edit quantity of Espresso')).toBeNull();
    expect(screen.queryByLabelText('Edit quantity of Cold Brew')).toBeNull();
    expect(screen.queryByTestId('cart-checkout')).toBeNull();
    // Leaving the page parks an open cart under the held-cart key; a voided one leaves nothing to restore.
    await act(async () => { expect(await runBeforeLeave()).toBeNull(); });
    expect(await parkedCarts.find().exec()).toEqual([]);
    expect(localStorage.getItem('held-test')).toBeNull();
    view.unmount();
    render(<><SaleScreen {...props} parkedCarts={parkedCarts} heldCartKey="held-test" /><PortalHost /></>);
    expect(await screen.findByTestId('new-order-tab')).not.toBeNull();
    expect(parkedTabs()).toHaveLength(0);
    expect(screen.queryByLabelText('Edit quantity of Espresso')).toBeNull();
    expect(screen.queryByLabelText('Edit quantity of Cold Brew')).toBeNull();
    expect(screen.queryByTestId('cart-checkout')).toBeNull();
  });
}, 20_000);

test('(f) an empty cart has no ⋮', () => {
  render(<><SaleScreen {...props} /><PortalHost /></>);
  expect(screen.queryByTestId('cart-checkout')).toBeNull();
  expect(screen.queryByTestId('cart-foot-more')).toBeNull();
  fireEvent.click(screen.getByText('Espresso'));
  expect(screen.getByTestId('cart-foot-more')).not.toBeNull();
}, 20_000);
