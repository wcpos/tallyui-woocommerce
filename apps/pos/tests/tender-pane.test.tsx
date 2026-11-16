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
import { OnlineStatusContext, type OnlineStatus } from '../lib/online/online-status';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';

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

// Browse by now opens on category tiles; these tests drive the flat product grid, so they browse All products.
beforeEach(() => { localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })); });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

/** One Espresso ($3.00) in the cart of a store that takes one payment per order, then the cart's `button`. */
async function startTender(button: 'Cash' | 'Card terminal', status: OnlineStatus = 'online-website-available') {
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({
    kind: 'results',
    results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 300 } })),
  }));
  const fakeTransport = { send };
  render(
    <OnlineStatusContext.Provider value={{ status }}>
      <SessionProvider>
        <OutboxProvider transportFor={() => fakeTransport} storage={getRxStorageMemory()}>
          <OrderStoreReady />
          <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
            storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
            multiplePayments={false} />
          <PortalHost />
        </OutboxProvider>
      </SessionProvider>
    </OnlineStatusContext.Provider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  // v2's foot: Checkout opens the tender on Cash; Card is picked on the tender pane's tiles.
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await screen.findByTestId('checkout-keypad');
  if (button === 'Card terminal') fireEvent.click(screen.getByTestId('checkout-method-pos_card'));
  return send;
}

const press = (...keys: string[]) => { for (const key of keys) fireEvent.click(screen.getByTestId(`checkout-keypad-key-${key}`)); };
const text = (testId: string) => screen.getByTestId(testId).textContent;
const disabled = () => screen.getByTestId('checkout-commit').getAttribute('aria-disabled');

async function sentPayments(send: Awaited<ReturnType<typeof startTender>>) {
  await screen.findByTestId('receipt-order');
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  const envelopes = send.mock.calls.flatMap(([batch]) => batch);
  expect(envelopes).toHaveLength(1);
  return envelopes[0].payload.payments;
}

test('cash: a keypad entry above the total shows the change and takes the total in cash', async () => {
  const send = await startTender('Cash');
  expect(screen.getByTestId('checkout-method-pos_cash').getAttribute('aria-selected')).toBe('true');
  expect(text('checkout-entry')).toBe('$3.00');
  expect(text('checkout-commit')).toBe('Take $3.00 in Cash');
  press('clear', '1', '0', '0', '0');
  expect(text('checkout-entry-hint')).toBe('Change $7.00');
  expect(text('checkout-tendered-line')).toBe('Tendered $10.00');
  fireEvent.click(screen.getByTestId('checkout-commit'));
  expect(await sentPayments(send)).toEqual([expect.objectContaining({ method: 'cash', amountMinor: 300, tenderedMinor: 1000, changeMinor: 700 })]);
}, 20_000);

test('keypad clear and backspace edit the entry in minor units and an entry under the total cannot be taken', async () => {
  await startTender('Cash');
  press('clear');
  expect(text('checkout-entry')).toBe('$0.00');
  expect(disabled()).toBe('true');
  press('2', '5');
  expect(text('checkout-entry')).toBe('$0.25');
  press('backspace');
  expect(text('checkout-entry')).toBe('$0.02');
  expect(text('checkout-entry-hint')).toBe('$2.98 left');
  expect(disabled()).toBe('true');
}, 20_000);

test('card refuses an over-tender and takes the total with the terminal reference', async () => {
  const send = await startTender('Card terminal');
  expect(screen.getByTestId('checkout-method-pos_card').getAttribute('aria-selected')).toBe('true');
  press('clear', '4', '0', '0');
  expect(text('checkout-entry-hint')).toBe("Only $3.00 is due — Card can't give change");
  expect(disabled()).toBe('true');
  press('clear', '3', '0', '0');
  expect(text('checkout-commit')).toBe('Take $3.00 in Card');
  expect(disabled()).not.toBe('true');
  fireEvent.change(screen.getByLabelText('Terminal reference'), { target: { value: 'T-9' } });
  fireEvent.click(screen.getByTestId('checkout-commit'));
  expect(await sentPayments(send)).toEqual([expect.objectContaining({ method: 'external', amountMinor: 300, reference: 'T-9' })]);
}, 20_000);

test('switching tiles changes the method the commit takes', async () => {
  await startTender('Cash');
  fireEvent.click(screen.getByTestId('checkout-method-pos_card'));
  expect(text('checkout-commit')).toBe('Take $3.00 in Card');
  expect(screen.getByLabelText('Terminal reference')).not.toBeNull();
  fireEvent.click(screen.getByTestId('checkout-method-pos_cash'));
  expect(text('checkout-commit')).toBe('Take $3.00 in Cash');
  expect(screen.queryByLabelText('Terminal reference')).toBeNull();
}, 20_000);

test('switching tiles then taking sends one payment in the chosen method', async () => {
  const send = await startTender('Cash');
  fireEvent.click(screen.getByTestId('checkout-method-pos_card'));
  fireEvent.change(screen.getByLabelText('Terminal reference'), { target: { value: 'T-1' } });
  fireEvent.click(screen.getByTestId('checkout-commit'));
  const payments = await sentPayments(send);
  expect(payments).toEqual([expect.objectContaining({ method: 'external', amountMinor: 300, reference: 'T-1' })]);
  expect(payments.some(payment => payment.method === 'cash')).toBe(false);
}, 20_000);

test('switching from card to cash then taking sends the cash tendered and its change', async () => {
  const send = await startTender('Card terminal');
  fireEvent.click(screen.getByTestId('checkout-method-pos_cash'));
  press('clear', '5', '0', '0');
  fireEvent.click(screen.getByTestId('checkout-commit'));
  expect(await sentPayments(send)).toEqual([expect.objectContaining({ method: 'cash', amountMinor: 300, tenderedMinor: 500, changeMinor: 200 })]);
}, 20_000);

test('cash shows quick amounts in order and takes the selected tender with change', async () => {
  const send = await startTender('Cash');
  expect(within(screen.getByTestId('checkout-helpers')).getAllByRole('button').map(chip => [chip.dataset.testid, chip.textContent])).toEqual([
    ['checkout-quick-3', '$3.00'],
    ['checkout-quick-5', '$5.00'],
    ['checkout-quick-10', '$10.00'],
    ['checkout-quick-50', '$50.00'],
    ['checkout-quick-exact', 'Exact $3.00'],
  ]);
  fireEvent.click(screen.getByTestId('checkout-quick-10'));
  expect(text('checkout-entry-hint')).toBe('Change $7.00');
  expect(text('checkout-tendered-line')).toBe('Tendered $10.00');
  fireEvent.click(screen.getByTestId('checkout-commit'));
  expect(await sentPayments(send)).toEqual([expect.objectContaining({ method: 'cash', amountMinor: 300, tenderedMinor: 1000, changeMinor: 700 })]);
}, 20_000);

test('Exact restores the amount due after a keypad edit', async () => {
  await startTender('Cash');
  press('clear', '1');
  expect(text('checkout-entry')).toBe('$0.01');
  fireEvent.click(screen.getByTestId('checkout-quick-exact'));
  expect(text('checkout-entry')).toBe('$3.00');
  expect(text('checkout-commit')).toBe('Take $3.00 in Cash');
}, 20_000);

test('card has no quick amounts and Full balance restores the amount due', async () => {
  await startTender('Card terminal');
  expect(screen.queryAllByTestId(/^checkout-quick-\d/)).toHaveLength(0);
  expect(screen.queryByTestId('checkout-quick-exact')).toBeNull();
  expect(text('checkout-quick-balance')).toBe('Full balance');
  press('clear', '1');
  expect(text('checkout-entry')).toBe('$0.01');
  expect(text('checkout-quick-balance')).toBe('Full balance $3.00');
  fireEvent.click(screen.getByTestId('checkout-quick-balance'));
  expect(text('checkout-entry')).toBe('$3.00');
}, 20_000);

test('cash quick amounts follow the applied entry', async () => {
  await startTender('Cash');
  press('clear', '2', '0', '0');
  expect(text('checkout-entry')).toBe('$2.00');
  expect(screen.getAllByTestId(/^checkout-quick-\d/).map(chip => chip.textContent)).toEqual(['$2.00', '$5.00', '$10.00', '$50.00']);
}, 20_000);

test('offline, both tiles say the payment is sent later and the store may refuse', async () => {
  await startTender('Cash', 'offline');
  expect(screen.getByTestId('checkout-method-sent-later-pos_cash').textContent).toBe('Sent laterStore may refuse');
  expect(screen.getByTestId('checkout-method-sent-later-pos_card').textContent).toBe('Sent laterStore may refuse');
  expect(disabled()).not.toBe('true');
}, 20_000);

test('a store that cannot be reached counts as offline for the tiles', async () => {
  await startTender('Card terminal', 'online-website-unavailable');
  expect(screen.getByTestId('checkout-method-sent-later-pos_card')).not.toBeNull();
}, 20_000);

test('online, the tiles carry no sent-later line', async () => {
  await startTender('Cash');
  expect(screen.queryByTestId('checkout-method-sent-later-pos_cash')).toBeNull();
  expect(screen.queryByTestId('checkout-method-sent-later-pos_card')).toBeNull();
}, 20_000);
