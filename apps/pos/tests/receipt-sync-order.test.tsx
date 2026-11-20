import { noTaxSettings } from './fixtures/store-settings';
import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { OrderCreateEnvelope } from '@tallyui/core';
import type { CommandTransport, PosOrder } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { OrdersScreen } from '../components/orders-screen';
import { canSyncOrder, ReceiptSyncOrder } from '../components/receipt-sync-order';
import { SaleScreen } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { dismissToast, getToasts } from '../lib/toast/toast';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeCash } from './tender-helpers';

// v2 receipt-actions.tsx:24-38 and hooks/use-sync-order.ts; copy core.json:34, :38 (order_synced) and :657 (failed_to_save_order).
const NOT_SAVED = 'Not saved to the store · no order number';
const AWAITING = 'Awaiting store · not yet confirmed';
const BUTTON = 'receipt-sync-order-button';

const props: ComponentProps<typeof SaleScreen> = {
  storeSettings: noTaxSettings,
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
};

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); } });
  signIn();
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
});

// A fresh site each time: a second sale in one test needs its own order store.
function signIn() {
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
}

afterEach(() => {
  cleanup();
  dismissToast();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.head.querySelectorAll('style[data-receipt-print], style[data-receipt-page]').forEach(style => style.remove());
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

type Send = CommandTransport<OrderCreateEnvelope>['send'];

const applied = (envelope: OrderCreateEnvelope) => ({ id: envelope.id, status: 'applied' as const,
  serverRefs: { orderId: '305', displayId: '305', totalMinor: 300 } });
const rejected = (envelope: OrderCreateEnvelope, code = 'store_configuration') => ({ id: envelope.id, status: 'rejected' as const,
  error: { code, message: 'A store setting needs changing.' } });

// The store holds an applied answer until the test releases it (never, for a sale the store has not heard); it refuses at once.
function gated(answer: typeof applied | typeof rejected) {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const send = vi.fn<Send>(async batch => {
    if (answer === applied) await gate;
    return { kind: 'results', results: batch.map(envelope => answer(envelope)) };
  });
  return { send, release };
}

// The store refuses the first batch and applies every later one.
function refuseThenApply() {
  let calls = 0;
  return vi.fn<Send>(async batch => {
    const first = calls++ === 0;
    return { kind: 'results', results: batch.map(envelope => (first ? rejected(envelope) : applied(envelope))) };
  });
}

async function sellEspresso(send: Send) {
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => ({ send })} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen {...props} />
        <OrdersScreen onBack={() => {}} history={null} storeName={props.storeName} cashierName={props.cashierName} />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await vi.waitFor(() => expect(screen.getByText('Order store ready')).not.toBeNull());
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await takeCash(300);
  await vi.waitFor(() => expect(screen.getByTestId('receipt-order')).not.toBeNull());
}

async function openOrdersReceipt() {
  fireEvent.click(screen.getByRole('button', { name: 'New sale' }));
  await vi.waitFor(() => expect(screen.getByTestId(/^order-open-/)).not.toBeNull());
  fireEvent.click(screen.getByTestId(/^order-open-/));
  await vi.waitFor(() => expect(screen.getByTestId('receipt-order')).not.toBeNull());
}

const refused = (code: string, extra: Partial<PosOrder> = {}) => ({ syncStatus: 'rejected' as const, error: { code, message: 'No.' }, ...extra });

test('canSyncOrder: only a refused, unsaved, requeueable order', () => {
  expect(canSyncOrder(refused('store_configuration'))).toBe(true);
  for (const code of ['idempotency_mismatch', 'coupon_invalid', 'total_mismatch']) expect(canSyncOrder(refused(code))).toBe(false);
  expect(canSyncOrder(refused('store_configuration', { serverRefs: { orderId: '305', totalMinor: 300 } }))).toBe(false);
  expect(canSyncOrder({ syncStatus: 'pending' })).toBe(false);
  expect(canSyncOrder({ syncStatus: 'applied', serverRefs: { orderId: '305', totalMinor: 300 } })).toBe(false);
  expect(canSyncOrder(undefined)).toBe(false);
});

test('a refused sale\'s receipt offers Save to store; pressing it resends the sale with a new command id and toasts Order #305 synced', async () => {
  const send = refuseThenApply();
  await sellEspresso(send);
  await vi.waitFor(() => expect(screen.getByTestId('receipt-store-line').textContent).toBe(NOT_SAVED));
  expect(screen.getByTestId(BUTTON).textContent).toBe('Save to store');
  fireEvent.click(screen.getByTestId(BUTTON));
  await vi.waitFor(() => {
    expect(screen.queryByTestId(BUTTON)).toBeNull();
    expect(screen.queryByTestId('receipt-store-line')).toBeNull();
  });
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[1][0][0].id).not.toBe(send.mock.calls[0][0][0].id);
  // The till's own success toast (Espresso added to cart) shares the stack, so count by title.
  await vi.waitFor(() => expect(getToasts().filter(t => t.type === 'success' && t.title === 'Order #305 synced')).toHaveLength(1));
}, 20_000);

test('a resend the store refuses again toasts Failed to save order and offers the button again', async () => {
  const { send } = gated(rejected);
  await sellEspresso(send);
  await vi.waitFor(() => expect(screen.getByTestId(BUTTON)).not.toBeNull());
  fireEvent.click(screen.getByTestId(BUTTON));
  await vi.waitFor(() => expect(getToasts().some(t => t.type === 'error' && t.title === 'Failed to save order')).toBe(true));
  await vi.waitFor(() => expect(screen.getByTestId(BUTTON).getAttribute('aria-disabled')).not.toBe('true'));
  expect(screen.getByTestId('receipt-store-line').textContent).toBe(NOT_SAVED);
  expect(send).toHaveBeenCalledTimes(2);
}, 20_000);

test('the Orders receipt of a refused sale offers Save to store, and resending it clears the line with the receipt still open', async () => {
  const send = refuseThenApply();
  await sellEspresso(send);
  await vi.waitFor(() => expect(screen.getByTestId('receipt-store-line').textContent).toBe(NOT_SAVED));
  await openOrdersReceipt();
  fireEvent.click(screen.getByTestId(BUTTON));
  await vi.waitFor(() => {
    expect(screen.queryByTestId(BUTTON)).toBeNull();
    expect(screen.queryByTestId('receipt-store-line')).toBeNull();
  });
  expect(screen.getByTestId('receipt-order')).not.toBeNull();
}, 20_000);

test('while the resent sale awaits the store, the button is gone and the line says Awaiting store', async () => {
  let calls = 0;
  const send = vi.fn<Send>(async batch => {
    if (calls++ > 0) return new Promise<never>(() => {});
    return { kind: 'results', results: batch.map(envelope => rejected(envelope)) };
  });
  await sellEspresso(send);
  await vi.waitFor(() => expect(screen.getByTestId(BUTTON)).not.toBeNull());
  fireEvent.click(screen.getByTestId(BUTTON));
  await vi.waitFor(() => {
    expect(screen.getByTestId('receipt-store-line').textContent).toBe(AWAITING);
    expect(screen.queryByTestId(BUTTON)).toBeNull();
  });
  expect(send).toHaveBeenCalledTimes(2);
}, 20_000);

test('no Save to store while the sale awaits the store, once it is saved, or when the refusal cannot be requeued', async () => {
  const { send, release } = gated(applied);
  await sellEspresso(send);
  expect(screen.getByTestId('receipt-store-line')).not.toBeNull();
  expect(screen.queryByTestId(BUTTON)).toBeNull();
  release();
  await vi.waitFor(() => expect(screen.queryByTestId('receipt-store-line')).toBeNull());
  expect(screen.queryByTestId(BUTTON)).toBeNull();
  cleanup();
  signIn();

  const refuse = vi.fn<Send>(async batch => ({ kind: 'results', results: batch.map(envelope => rejected(envelope, 'idempotency_mismatch')) }));
  await sellEspresso(refuse);
  await vi.waitFor(() => expect(screen.getByTestId('receipt-store-line').textContent).toBe(NOT_SAVED));
  expect(screen.queryByTestId(BUTTON)).toBeNull();
}, 20_000);

const order = (extra: Partial<PosOrder> = {}) => ({ id: 'o1', commandId: 'c1', ...refused('store_configuration'), ...extra });

test('a second press while one is in flight does nothing', () => {
  const onRequeue = vi.fn(() => new Promise<number>(() => {}));
  render(<ReceiptSyncOrder posOrder={order()} onRequeue={onRequeue} />);
  fireEvent.click(screen.getByTestId(BUTTON));
  fireEvent.click(screen.getByTestId(BUTTON));
  expect(onRequeue).toHaveBeenCalledTimes(1);
  expect(onRequeue).toHaveBeenCalledWith(['o1']);
  expect(screen.getByTestId(BUTTON).getAttribute('aria-disabled')).toBe('true');
});

test('a requeue of 0 or a throw toasts Failed to save order', async () => {
  const onRequeue = vi.fn().mockResolvedValueOnce(0).mockRejectedValueOnce(new Error('offline'));
  render(<ReceiptSyncOrder posOrder={order()} onRequeue={onRequeue} />);
  fireEvent.click(screen.getByTestId(BUTTON));
  await vi.waitFor(() => expect(getToasts().map(t => [t.type, t.title])).toEqual([['error', 'Failed to save order']]));
  dismissToast();
  await vi.waitFor(() => expect(screen.getByTestId(BUTTON).getAttribute('aria-disabled')).not.toBe('true'));
  fireEvent.click(screen.getByTestId(BUTTON));
  await vi.waitFor(() => expect(getToasts().map(t => [t.type, t.title])).toEqual([['error', 'Failed to save order']]));
  expect(onRequeue).toHaveBeenCalledTimes(2);
});

test('an order still carrying the pressed command id is not read as the outcome', async () => {
  const onRequeue = vi.fn().mockResolvedValue(1);
  const view = render(<ReceiptSyncOrder posOrder={order()} onRequeue={onRequeue} />);
  fireEvent.click(screen.getByTestId(BUTTON));
  await act(async () => { await Promise.resolve(); });
  view.rerender(<ReceiptSyncOrder posOrder={order()} onRequeue={onRequeue} />);
  expect(getToasts()).toEqual([]);
  view.rerender(<ReceiptSyncOrder posOrder={order({ commandId: 'c2' })} onRequeue={onRequeue} />);
  await vi.waitFor(() => expect(getToasts().map(t => [t.type, t.title])).toEqual([['error', 'Failed to save order']]));
});
