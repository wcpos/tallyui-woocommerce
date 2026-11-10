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
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeLeg } from './tender-helpers';

let orders: (ReturnType<typeof useOutbox> & { enabled: true })['orders'];

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  });
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
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
  return <span>Order store ready</span>;
}

/** Espresso ×2 ($6.00) in the cart of a store that takes several payments per order, then the cart's `button`. */
async function renderSale(button: 'Cash' | 'Card terminal' = 'Cash', width = 900) {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({
    kind: 'results',
    results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 600 } })),
  }));
  const fakeTransport = { send };
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => fakeTransport} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
          multiplePayments />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  if (width < 900) fireEvent.click(screen.getByRole('button', { name: /Open cart/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(screen.getByRole('button', { name: button }));
  return send;
}

const press = (...keys: string[]) => { for (const key of keys) fireEvent.click(screen.getByTestId(`checkout-keypad-key-${key}`)); };
const text = (testId: string) => screen.getByTestId(testId).textContent;
const disabled = () => screen.getByTestId('checkout-commit').getAttribute('aria-disabled');
const legs = () => screen.queryAllByTestId(/^checkout-leg-/);

test('the ledger beside the tender shows the total and no payments yet', async () => {
  await renderSale();
  expect(within(screen.getByTestId('pos-products-panel')).getByTestId('checkout-ledger')).not.toBeNull();
  expect(text('checkout-ledger-eyebrow')).toBe('Total');
  expect(text('checkout-ledger-balance')).toBe('$6.00');
  expect(text('checkout-ledger-empty')).toBe('No payments yet');
  expect(text('checkout-ledger-totals')).toBe('Total$6.00Paid$0.00Remaining$6.00');
  expect(text('checkout-label')).toBe('To pay');
  expect(text('checkout-commit')).toBe('Take $6.00 in Cash');
}, 20_000);

test('a part payment adds a leg and moves the ledger and the tender to the remaining balance', async () => {
  const send = await renderSale();
  takeLeg(200);
  expect(legs()).toHaveLength(1);
  expect(legs()[0].textContent).toContain('Cash');
  expect(legs()[0].textContent).toContain('$2.00');
  expect(text('checkout-ledger-eyebrow')).toBe('Remaining');
  expect(text('checkout-ledger-balance')).toBe('$4.00');
  expect(text('checkout-ledger-paid-of')).toBe('$2.00 of $6.00 paid');
  expect(text('checkout-ledger-totals')).toBe('Total$6.00Paid$2.00Remaining$4.00');
  expect(text('checkout-label')).toBe('Payment 2 · $4.00 left');
  expect(text('checkout-entry')).toBe('$4.00');
  expect(text('checkout-commit')).toBe('Take $4.00 in Cash · pays it off');
  press('clear', '1', '0', '0');
  expect(text('checkout-commit')).toBe('Take $1.00 in Cash · $3.00 left');
  expect(disabled()).not.toBe('true');
  expect(screen.queryByTestId('receipt-order')).toBeNull();
  expect(send).not.toHaveBeenCalled();
}, 20_000);

test('a card leg is capped at the balance and refuses an over-tender', async () => {
  await renderSale();
  takeLeg(200);
  fireEvent.click(screen.getByTestId('checkout-method-pos_card'));
  press('clear', '5', '0', '0');
  expect(text('checkout-entry-hint')).toBe("Only $4.00 is due — Card can't give change");
  expect(disabled()).toBe('true');
  expect(legs()).toHaveLength(1);
}, 20_000);

test('the leg that covers the balance completes the sale with every leg and the change on the last', async () => {
  const send = await renderSale();
  takeLeg(200);
  press('clear', '5', '0', '0');
  expect(text('checkout-entry-hint')).toBe('Change $1.00');
  expect(text('checkout-commit')).toBe('Take $4.00 in Cash · pays it off');
  fireEvent.click(screen.getByTestId('checkout-commit'));
  await screen.findByTestId('receipt-order');
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  const envelopes = send.mock.calls.flatMap(([batch]) => batch);
  expect(envelopes).toHaveLength(1);
  expect(envelopes[0].payload.payments).toEqual([
    expect.objectContaining({ method: 'cash', amountMinor: 200 }),
    expect.objectContaining({ method: 'cash', amountMinor: 400, tenderedMinor: 500, changeMinor: 100 }),
  ]);
}, 20_000);

test('Remove takes the leg off the ledger and the untouched entry follows the balance back', async () => {
  await renderSale();
  takeLeg(200);
  fireEvent.click(screen.getByTestId(/^checkout-remove-leg-/));
  await waitFor(() => expect(legs()).toHaveLength(0));
  expect(text('checkout-ledger-balance')).toBe('$6.00');
  expect(text('checkout-ledger-empty')).toBe('No payments yet');
  // The entry follows the balance in an effect, which can land after the leg leaves.
  await waitFor(() => expect(text('checkout-entry')).toBe('$6.00'));
  expect(text('checkout-label')).toBe('To pay');
}, 20_000);

test('Card terminal from the cart starts with nothing paid and the card tile chosen', async () => {
  await renderSale('Card terminal');
  expect(screen.getByTestId('checkout-method-pos_card').getAttribute('aria-selected')).toBe('true');
  expect(text('checkout-ledger-empty')).toBe('No payments yet');
  expect(text('checkout-ledger-totals')).toBe('Total$6.00Paid$0.00Remaining$6.00');
  expect(text('checkout-entry')).toBe('$6.00');
  expect(text('checkout-commit')).toBe('Take $6.00 in Card');
}, 20_000);

test('on a narrow screen the legs sit under the tender in one column without the totals', async () => {
  await renderSale('Cash', 600);
  expect(screen.queryByTestId('pos-products-panel')).toBeNull();
  expect(screen.getByTestId('checkout-tender')).not.toBeNull();
  expect(screen.getByTestId('checkout-ledger')).not.toBeNull();
  expect(screen.queryByTestId('checkout-ledger-totals')).toBeNull();
  takeLeg(200);
  expect(legs()).toHaveLength(1);
  expect(screen.getByTestId(/^checkout-remove-leg-/)).not.toBeNull();
}, 20_000);

test('a failed save offers Retry, and Retry finishes the sale', async () => {
  await renderSale();
  vi.spyOn(orders!, 'insert').mockRejectedValueOnce(new Error('disk full'));
  takeLeg(600);
  await screen.findByText('The sale could not be saved: disk full');
  expect(text('checkout-commit')).toBe('Retry');
  expect(disabled()).not.toBe('true');
  expect(text('checkout-ledger-paid-in-full')).toBe('Paid in full');
  fireEvent.click(screen.getByTestId('checkout-commit'));
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
}, 20_000);
