import { noTaxSettings } from './fixtures/store-settings';
import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { Text } from '@tallyui/components';
import type { OrderCreateEnvelope, StoreOrder } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { OrdersScreen } from '../components/orders-screen';
import { ReceiptPrintSheet } from '../components/receipt-print-sheet';
import { SaleScreen } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import type { OrderHistorySource } from '../lib/orders/order-history';
import { installReceiptPrintStyle, printReceipt, receiptPrintCss, RECEIPT_PAGE_CSS, RECEIPT_PAPER_WIDTH } from '../lib/receipts/print-receipt';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

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
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  document.head.querySelectorAll('style[data-receipt-print], style[data-receipt-page]').forEach(style => style.remove());
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

async function setup(send: CommandTransport<OrderCreateEnvelope>['send'], history: OrderHistorySource | null = null) {
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => ({ send })} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen {...props} />
        <OrdersScreen onBack={() => {}} history={history} storeName={props.storeName} cashierName={props.cashierName} />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await vi.waitFor(() => expect(screen.getByText('Order store ready')).not.toBeNull());
}

async function payCash() {
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  const complete = await screen.findByRole('button', { name: 'Complete sale' });
  fireEvent.change(within(complete.parentElement!).getByRole('textbox'), { target: { value: '3.00' } });
  fireEvent.click(complete);
  await vi.waitFor(() => expect(screen.getByTestId('receipt-order')).not.toBeNull());
  return /^Order ([a-f0-9]{8})/.exec(screen.getByTestId('receipt-order').textContent!)![1];
}

const applied = (envelope: OrderCreateEnvelope) => ({ id: envelope.id, status: 'applied' as const,
  serverRefs: { orderId: '305', displayId: '305', totalMinor: 300 } });

const storeOrder: StoreOrder = {
  id: '901', reference: '901', status: 'completed', placedAt: '2026-10-15T10:00:00Z',
  currency: 'USD', pricesIncludeTax: false, customer: null,
  lines: [{ id: '1', name: 'Espresso', quantity: 2, subtotalMinor: 600, subtotalTaxMinor: 0, totalMinor: 600, taxMinor: 0 }],
  fees: [], shipping: [], coupons: [], taxLines: [], refunds: [],
  payments: [{ method: 'pos_cash', title: 'Cash', kind: 'cash', amountMinor: 600 }],
  discountMinor: 0, discountTaxMinor: 0, taxMinor: 0, totalMinor: 600,
};

test("receiptPrintCss puts the page on the printer's own paper and the receipt at paper width", () => {
  expect(RECEIPT_PAGE_CSS).toBe('@page { size: auto; margin: 0; }');
  expect(receiptPrintCss('80mm', 'receipt-x')).not.toContain('@page');
  expect(receiptPrintCss('80mm', 'receipt-x')).toContain('width: 80mm !important');
  expect(receiptPrintCss('80mm', 'receipt-x')).not.toContain('58mm');
  expect(receiptPrintCss('58mm', 'receipt-x')).toContain('width: 58mm !important');
  expect(RECEIPT_PAPER_WIDTH).toBe('80mm');
});

test('receiptPrintCss steps aside while a closure document is mounted', () => {
  expect(receiptPrintCss('80mm', 'receipt-x')).toContain(':root:not(:has([data-print="closure"]))');
});

test('installReceiptPrintStyle adds one print style and its cleanup removes it', () => {
  const remove = installReceiptPrintStyle('receipt-x');
  const styles = document.head.querySelectorAll('style[data-receipt-print="80mm"]');
  expect(styles).toHaveLength(1);
  expect(styles[0].textContent).toBe(receiptPrintCss('80mm', 'receipt-x'));
  remove();
  expect(document.head.querySelectorAll('style[data-receipt-print="80mm"]')).toHaveLength(0);
});

test('receiptPrintCss hides everything outside its own area', () => {
  const css = receiptPrintCss('80mm', 'receipt-x');
  expect(css).toContain(':not(:has([data-receipt="receipt-x"])):not([data-receipt="receipt-x"])');
  expect(css).toContain('[data-receipt="receipt-x"] [data-print="hide"]');
  expect(css).not.toContain('[data-print="receipt"]');
});

test('the page rule is mounted only between beforeprint and afterprint', () => {
  const remove = installReceiptPrintStyle('receipt-x');
  expect(document.head.querySelector('style[data-receipt-page]')).toBeNull();
  window.dispatchEvent(new Event('beforeprint'));
  expect(document.head.querySelectorAll('style[data-receipt-page]')).toHaveLength(1);
  expect(document.head.querySelector('style[data-receipt-page]')?.textContent).toBe(RECEIPT_PAGE_CSS);
  window.dispatchEvent(new Event('beforeprint'));
  expect(document.head.querySelectorAll('style[data-receipt-page]')).toHaveLength(1);
  window.dispatchEvent(new Event('afterprint'));
  expect(document.head.querySelector('style[data-receipt-page]')).toBeNull();
  remove();
  window.dispatchEvent(new Event('beforeprint'));
  expect(document.head.querySelector('style[data-receipt-page]')).toBeNull();
});

test('the page rule steps aside while a closure document is mounted', () => {
  const closure = document.createElement('div');
  closure.setAttribute('data-print', 'closure');
  document.body.appendChild(closure);
  const remove = installReceiptPrintStyle('receipt-x');
  try {
    window.dispatchEvent(new Event('beforeprint'));
    expect(document.head.querySelector('style[data-receipt-page]')).toBeNull();
    closure.remove();
    window.dispatchEvent(new Event('afterprint'));
    window.dispatchEvent(new Event('beforeprint'));
    expect(document.head.querySelectorAll('style[data-receipt-page]')).toHaveLength(1);
  } finally {
    window.dispatchEvent(new Event('afterprint'));
    remove();
    closure.remove();
  }
});

test('the cleanup removes its print listeners', () => {
  const addEventListener = vi.spyOn(window, 'addEventListener');
  const removeEventListener = vi.spyOn(window, 'removeEventListener');
  const remove = installReceiptPrintStyle('receipt-x');
  remove();
  for (const event of ['beforeprint', 'afterprint']) {
    const handler = addEventListener.mock.calls.find(([type]) => type === event)?.[1];
    expect(handler).toBeTypeOf('function');
    expect(removeEventListener).toHaveBeenCalledWith(event, handler);
  }
});

test('two mounted receipt sheets print from different areas, and only the newer one is active', () => {
  render(<>
    <ReceiptPrintSheet orderId={null}><Text>First receipt</Text></ReceiptPrintSheet>
    <ReceiptPrintSheet orderId={null}><Text>Second receipt</Text></ReceiptPrintSheet>
  </>);
  const areas = screen.getAllByTestId('receipt-print-area');
  expect(areas).toHaveLength(2);
  const firstArea = areas[0].getAttribute('data-receipt');
  const secondArea = areas[1].getAttribute('data-receipt');
  expect(firstArea).toBeTruthy();
  expect(secondArea).toBeTruthy();
  expect(firstArea).not.toBe(secondArea);
  const styles = Array.from(document.head.querySelectorAll<HTMLStyleElement>('style[data-receipt-print]'));
  expect(styles).toHaveLength(2);
  const activeStyles = styles.filter(style => style.media === 'all');
  expect(activeStyles).toHaveLength(1);
  expect(activeStyles[0].textContent).toContain(`[data-receipt="${secondArea}"]`);
});

test('only the newest receipt style prints, and the older one returns when it goes', () => {
  const removeA = installReceiptPrintStyle('receipt-a');
  const removeB = installReceiptPrintStyle('receipt-b');
  const styles = Array.from(document.head.querySelectorAll<HTMLStyleElement>('style[data-receipt-print]'));
  const styleA = styles.find(style => style.textContent?.includes('receipt-a'))!;
  const styleB = styles.find(style => style.textContent?.includes('receipt-b'))!;
  expect(styleA.media).toBe('not all');
  expect(styleB.media).toBe('all');
  window.dispatchEvent(new Event('beforeprint'));
  expect(document.head.querySelectorAll('style[data-receipt-page]')).toHaveLength(1);
  window.dispatchEvent(new Event('afterprint'));
  removeB();
  expect(styleA.media).toBe('all');
  removeA();
});

test("TallyUI's Print receipt button prints with the page rule", async () => {
  await setup(async batch => ({ kind: 'results', results: batch.map(applied) }));
  await payCash();
  let pageAtPrint = false;
  vi.spyOn(window, 'print').mockImplementation(() => {
    window.dispatchEvent(new Event('beforeprint'));
    pageAtPrint = document.head.querySelector('style[data-receipt-page]') !== null;
    window.dispatchEvent(new Event('afterprint'));
  });
  fireEvent.click(screen.getByRole('button', { name: 'Print receipt' }));
  expect(pageAtPrint).toBe(true);
}, 20_000);

test('printReceipt opens the print dialog once and reports no error', () => {
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  expect(printReceipt()).toBeNull();
  expect(print).toHaveBeenCalledTimes(1);
});

test('printReceipt says why when the dialog cannot open', () => {
  vi.spyOn(window, 'print').mockImplementation(() => { throw new Error('blocked'); });
  expect(printReceipt()).toBe('The receipt did not print: blocked');
});

test('the sale receipt prints from a receipt-only area at paper width', async () => {
  await setup(async batch => ({ kind: 'results', results: batch.map(applied) }));
  await payCash();
  const area = screen.getByTestId('receipt-print-area');
  expect(area.getAttribute('data-print')).toBe('receipt');
  const receiptArea = area.getAttribute('data-receipt');
  expect(receiptArea).toBeTruthy();
  expect(document.head.querySelector('style[data-receipt-print="80mm"]')?.textContent).toContain(`[data-receipt="${receiptArea}"]`);
  expect(within(area).getByTestId('receipt-order')).not.toBeNull();
  expect(document.head.querySelector('style[data-receipt-print="80mm"]')).not.toBeNull();
  let receiptAtPrint = false, styleAtPrint = false;
  const print = vi.spyOn(window, 'print').mockImplementation(() => {
    receiptAtPrint = document.querySelector('[data-print="receipt"] [data-testid="receipt-order"]') !== null;
    styleAtPrint = document.head.querySelector('style[data-receipt-print="80mm"]') !== null;
  });
  fireEvent.click(screen.getByRole('button', { name: 'Print receipt' }));
  expect(print).toHaveBeenCalledTimes(1);
  expect(receiptAtPrint).toBe(true);
  expect(styleAtPrint).toBe(true);
  expect(screen.queryByTestId('receipt-print-again')).toBeNull();
}, 20_000);

test('Print again appears after a print and prints again', async () => {
  await setup(async batch => ({ kind: 'results', results: batch.map(applied) }));
  await payCash();
  act(() => { window.dispatchEvent(new Event('afterprint')); });
  expect(screen.getByTestId('receipt-print-again').textContent).toBe('Print again');
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  fireEvent.click(screen.getByTestId('receipt-print-again'));
  expect(print).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('print-sheet-error')).toBeNull();
}, 20_000);

test('Print again says why a print failed', async () => {
  await setup(async batch => ({ kind: 'results', results: batch.map(applied) }));
  await payCash();
  act(() => { window.dispatchEvent(new Event('afterprint')); });
  expect(screen.getByTestId('receipt-print-again').textContent).toBe('Print again');
  const print = vi.spyOn(window, 'print').mockImplementation(() => { throw new Error('blocked'); });
  fireEvent.click(screen.getByTestId('receipt-print-again'));
  expect(print).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('print-sheet-error').textContent).toBe('The receipt did not print: blocked');
}, 20_000);

test('starting a new sale removes the receipt print style', async () => {
  await setup(async batch => ({ kind: 'results', results: batch.map(applied) }));
  await payCash();
  fireEvent.click(screen.getByRole('button', { name: 'New sale' }));
  expect(screen.queryByTestId('receipt-print-area')).toBeNull();
  expect(document.head.querySelector('style[data-receipt-print]')).toBeNull();
}, 20_000);

test('an Orders reprint prints from the same receipt-only area', async () => {
  const list = vi.fn<OrderHistorySource['list']>(async () => ({ orders: [storeOrder], hasMore: false }));
  await setup(async batch => ({ kind: 'results', results: batch.map(applied) }), { list });
  expect(await screen.findByText('Order 901 · 2 items')).not.toBeNull();
  fireEvent.click(screen.getByTestId(`history-open-${storeOrder.id}`));
  fireEvent.click(screen.getByTestId('order-modal-receipt'));
  const area = screen.getByTestId('receipt-print-area');
  expect(within(area).getByTestId('receipt-order').textContent).toBe('Order 901');
  expect(screen.queryByTestId('receipt-print-again')).toBeNull();
  act(() => { window.dispatchEvent(new Event('afterprint')); });
  expect(screen.getByTestId('receipt-print-again')).not.toBeNull();
  fireEvent.click(screen.getAllByRole('button', { name: 'Back' }).find(button => button.getAttribute('data-testid') !== 'orders-back')!);
  expect(document.head.querySelector('style[data-receipt-print]')).toBeNull();
}, 20_000);
