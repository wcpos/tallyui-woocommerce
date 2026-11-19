import { noTaxSettings } from './fixtures/store-settings';
import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { OrderCreateEnvelope } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { OrdersScreen } from '../components/orders-screen';
import { receiptStoreLine } from '../components/receipt-store-line';
import { SaleScreen } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeCash } from './tender-helpers';

// v2 use-receipt-document.ts:100-108 and mark-awaiting-store.ts:10; copy core.json:1354, :1367.
const AWAITING = 'Awaiting store · not yet confirmed';
const NOT_SAVED = 'Not saved to the store · no order number';

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
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
});

afterEach(() => {
  cleanup();
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
const rejected = (envelope: OrderCreateEnvelope) => ({ id: envelope.id, status: 'rejected' as const,
  error: { code: 'store_configuration', message: 'A store setting needs changing.' } });

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

// On paper: inside the print area, before the receipt, and under no print-hide block.
function expectPrinted(line: HTMLElement) {
  const area = screen.getByTestId('receipt-print-area');
  expect(area.contains(line)).toBe(true);
  expect(line.closest('[data-print="hide"]')).toBeNull();
  expect(line.compareDocumentPosition(screen.getByTestId('receipt-order')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

test('receiptStoreLine maps pending to awaiting, a refused unsaved sale to not saved, and a confirmed sale or no order to none', () => {
  expect(receiptStoreLine({ syncStatus: 'pending' })).toBe(AWAITING);
  expect(receiptStoreLine({ syncStatus: 'pending', serverRefs: { orderId: '305', totalMinor: 300 } })).toBe(AWAITING);
  expect(receiptStoreLine({ syncStatus: 'rejected' })).toBe(NOT_SAVED);
  expect(receiptStoreLine({ syncStatus: 'applied', serverRefs: { orderId: '305', totalMinor: 300 } })).toBeNull();
  expect(receiptStoreLine(undefined)).toBeNull();
});

test('the sale receipt stage opens with Awaiting store · not yet confirmed until the store confirms the sale', async () => {
  const { send, release } = gated(applied);
  await sellEspresso(send);
  expect(screen.getByTestId('receipt-store-line').textContent).toBe(AWAITING);
  release();
  await vi.waitFor(() => expect(screen.queryByTestId('receipt-store-line')).toBeNull());
}, 20_000);

test('the Orders receipt of a sale the store has not heard opens with the awaiting line', async () => {
  const { send } = gated(applied);
  await sellEspresso(send);
  await openOrdersReceipt();
  expect(screen.getByTestId('receipt-store-line').textContent).toBe(AWAITING);
}, 20_000);

test('the Orders receipt of a refused sale says Not saved to the store · no order number', async () => {
  const { send } = gated(rejected);
  await sellEspresso(send);
  await vi.waitFor(() => expect(screen.getByTestId('receipt-store-line').textContent).toBe(NOT_SAVED));
  await openOrdersReceipt();
  expect(screen.getByTestId('receipt-store-line').textContent).toBe(NOT_SAVED);
}, 20_000);

test('the Orders receipt of a confirmed sale has no store line', async () => {
  const { send, release } = gated(applied);
  release();
  await sellEspresso(send);
  await vi.waitFor(() => expect(screen.queryByTestId('receipt-store-line')).toBeNull());
  await openOrdersReceipt();
  expect(screen.queryByTestId('receipt-store-line')).toBeNull();
}, 20_000);

test('the line prints: it sits inside the print area, before the receipt, outside every print-hide block', async () => {
  const { send } = gated(applied);
  await sellEspresso(send);
  expectPrinted(screen.getByTestId('receipt-store-line'));
  await openOrdersReceipt();
  expectPrinted(screen.getByTestId('receipt-store-line'));
}, 20_000);

// orders-screen.tsx reads the outbox's live copy: the opened row is a snapshot taken when the receipt opened.
test('the awaiting line on an open Orders receipt goes when the store confirms the sale, and the receipt stays open', async () => {
  const { send, release } = gated(applied);
  await sellEspresso(send);
  await openOrdersReceipt();
  expect(screen.getByTestId('receipt-store-line').textContent).toBe(AWAITING);
  release();
  await vi.waitFor(() => expect(screen.queryByTestId('receipt-store-line')).toBeNull());
  expect(screen.getByTestId('receipt-order')).not.toBeNull();
}, 20_000);
