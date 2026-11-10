import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import type { OrderCreateEnvelope, StoreOrder } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { ORDER_SHEET, OrderDetailSheet, statusDotClass } from '../components/order-detail';
import { OrdersScreen } from '../components/orders-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import type { OrderHistorySource } from '../lib/orders/order-history';
import stores from './fixtures/stores.json';

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

function make(overrides: Partial<StoreOrder> = {}): StoreOrder {
  return {
    id: '901', reference: '901', status: 'completed', placedAt: '2026-10-15T10:00:00Z', currency: 'USD',
    pricesIncludeTax: false, customer: null,
    lines: [{ id: '1', name: 'Espresso', quantity: 2, subtotalMinor: 600, subtotalTaxMinor: 0, totalMinor: 600, taxMinor: 0 }],
    fees: [], shipping: [], coupons: [], taxLines: [], refunds: [],
    payments: [{ method: 'pos_cash', title: 'Cash', kind: 'cash', amountMinor: 600 }],
    discountMinor: 0, discountTaxMinor: 0, taxMinor: 0, totalMinor: 600, ...overrides,
  };
}

function sheet(order: StoreOrder, onReceipt = vi.fn(), onClose = vi.fn()) {
  render(<><OrderDetailSheet order={order} onReceipt={onReceipt} onClose={onClose} /><PortalHost /></>);
  return { onReceipt, onClose };
}
const part = (testID: string) => within(screen.getByTestId(testID));

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

async function screenWith(order: StoreOrder) {
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>();
  const list = vi.fn<OrderHistorySource['list']>(async () => ({ orders: [order], hasMore: false }));
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => ({ send })} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <OrdersScreen onBack={() => {}} history={{ list }} storeName={stores[0].name} cashierName="Paul" />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await vi.waitFor(() => expect(screen.getByText('Order store ready')).not.toBeNull());
  expect(await screen.findByTestId(`history-row-${order.id}`)).not.toBeNull();
  return send;
}

test('the sheet is v2\'s right side panel: 560 wide, full height, square, a left hairline on the card', () => {
  const classes = ORDER_SHEET.split(' ');
  for (const name of ['left-auto', 'right-0', 'top-0', 'h-full', 'max-w-[560px]', 'translate-x-0', 'translate-y-0', 'rounded-none', 'border-l', 'bg-card']) {
    expect(classes).toContain(name);
  }
  for (const name of ['left-0', 'max-w-lg', 'rounded-lg']) expect(classes).not.toContain(name);
});

test('the sheet carries the order title and v2\'s close, which closes it', () => {
  const { onReceipt, onClose } = sheet(make({ reference: '901' }));
  expect(screen.getByTestId('order-modal')).not.toBeNull();
  expect(part('order-modal').getByTestId('order-modal-title').textContent).toBe('Order #901');
  expect(screen.getByTestId('order-modal-close').getAttribute('aria-label')).toBe('Close');
  fireEvent.click(screen.getByTestId('order-modal-close'));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onReceipt).not.toHaveBeenCalled();
});

test('the footer is v2\'s read-only footer: Close then Receipt', () => {
  const { onReceipt, onClose } = sheet(make());
  expect(part('order-modal-footer').getAllByRole('button').map(button => button.textContent)).toEqual(['Close', 'Receipt']);
  fireEvent.click(screen.getByTestId('dialog-footer-close'));
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByTestId('order-modal-receipt'));
  expect(onReceipt).toHaveBeenCalledTimes(1);
  for (const id of ['order-modal-reopen', 'order-modal-delete', 'order-modal-sync', 'order-modal-refund']) {
    expect(screen.queryByTestId(id)).toBeNull();
  }
  const text = screen.getByTestId('order-modal').textContent ?? '';
  expect(text).not.toContain('Edit');
  expect(text).not.toContain('JSON');
});

test('the status is v2\'s dot and word, in v2\'s tones', () => {
  const tones: [string, boolean, string][] = [
    ['completed', false, 'bg-success'], ['processing', false, 'bg-info'], ['pos-open', false, 'bg-info'],
    ['pos-partial', false, 'bg-warning'], ['completed', true, 'bg-warning'], ['failed', false, 'bg-destructive'],
    ['cancelled', false, 'bg-muted-foreground'], ['custom-x', false, 'bg-primary'],
  ];
  for (const [status, partial, tone] of tones) expect(statusDotClass(status, partial).split(' ')).toContain(tone);
  sheet(make({ status: 'processing' }));
  const status = screen.getByTestId('order-modal-status');
  expect(status.textContent).toBe('Processing');
  expect(status.querySelectorAll('[aria-hidden]')).toHaveLength(1);
});

test('an open order with nothing paid shows No payments yet, then Total, Paid and Remaining', () => {
  sheet(make({ status: 'pos-open', payments: [], totalMinor: 1683 }));
  expect(part('order-modal-payments').getByText('Payment')).not.toBeNull();
  expect(screen.getByTestId('order-modal-no-payments').textContent).toBe('No payments yet');
  const rows: [string, string[]][] = [['total', ['Total', '$16.83']], ['paid', ['Paid', '$0.00']], ['remaining', ['Remaining', '$16.83']]];
  for (const [row, texts] of rows) {
    for (const text of texts) expect(part(`order-modal-ledger-${row}`).getByText(text)).not.toBeNull();
  }
});

test('an order the store counts as paid, or a dead one, shows no Payment section when nothing was paid', () => {
  for (const status of ['completed', 'processing', 'on-hold', 'custom-paid', 'cancelled', 'failed', 'trash']) {
    sheet(make({ status, payments: [] }));
    expect(screen.queryByTestId('order-modal-payments'), status).toBeNull();
    cleanup();
  }
  for (const status of ['pending', 'pos-partial']) {
    sheet(make({ status, payments: [] }));
    expect(screen.queryByTestId('order-modal-payments'), status).not.toBeNull();
    expect(screen.queryByTestId('order-modal-ledger'), status).not.toBeNull();
    cleanup();
  }
});

test('a paid order lists its payment and no Remaining', () => {
  sheet(make({ status: 'pending', payments: [{ method: 'bacs', title: 'Bank transfer', amountMinor: 600 }] }));
  expect(part('order-modal-payment').getByText('Bank transfer')).not.toBeNull();
  expect(part('order-modal-payment').getByText('$6.00')).not.toBeNull();
  expect(screen.queryByTestId('order-modal-ledger')).toBeNull();
  expect(screen.queryByTestId('order-modal-no-payments')).toBeNull();
});

test('a refund shows in Payment as well as in Totals', () => {
  sheet(make({ refunds: [{ id: 'r1', amountMinor: 200 }] }));
  expect(part('order-modal-payment-refund').getByText('Refund')).not.toBeNull();
  expect(part('order-modal-payment-refund').getByText('-$2.00')).not.toBeNull();
  expect(screen.getByTestId('order-modal-total-refund')).not.toBeNull();
  cleanup();
  sheet(make({ status: 'refunded', payments: [], refunds: [{ id: 'r1', amountMinor: 600 }] }));
  expect(screen.getByTestId('order-modal-payments')).not.toBeNull();
  expect(part('order-modal-payment-refund').getByText('-$6.00')).not.toBeNull();
  expect(screen.queryByTestId('order-modal-ledger')).toBeNull();
});

test('the demo order reads as v2 draws it: SKU chip, tax by rate and the total', () => {
  sheet(make({
    lines: [{ id: '1', name: 'Affirm Water Bottle', sku: '2000000000329', quantity: 1, subtotalMinor: 1500, subtotalTaxMinor: 0, totalMinor: 1500, taxMinor: 0 }],
    taxLines: [{ label: 'US', ratePpm: 100000, amountMinor: 150 }, { label: 'US AL', ratePpm: 20000, amountMinor: 33 }],
    taxMinor: 183, totalMinor: 1683, payments: [{ method: 'pos_cash', title: 'Cash', kind: 'cash', amountMinor: 1683 }],
  }));
  expect(part('order-modal-line-0').getByText('2000000000329')).not.toBeNull();
  expect(part('order-modal-total-tax').getByText('$1.83')).not.toBeNull();
  const rows: [string, string[]][] = [['tax-0', ['US 10%', '$1.50']], ['tax-1', ['US AL 2%', '$0.33']], ['total', ['Total', '$16.83']]];
  for (const [row, texts] of rows) {
    for (const text of texts) expect(part(`order-modal-total-${row}`).getByText(text)).not.toBeNull();
  }
});

test('opening a store order draws the sheet over the list, which stays behind', async () => {
  const send = await screenWith(make());
  fireEvent.click(screen.getByTestId('history-open-901'));
  expect(screen.getByTestId('order-modal-title').textContent).toBe('Order #901');
  expect(screen.getByTestId('history-row-901')).not.toBeNull();
  fireEvent.click(screen.getByTestId('order-modal-close'));
  expect(screen.queryByTestId('order-modal')).toBeNull();
  expect(screen.getByTestId('history-row-901')).not.toBeNull();
  expect(send).not.toHaveBeenCalled();
});

test('Receipt hands the sheet over to the reprint', async () => {
  const send = await screenWith(make());
  fireEvent.click(screen.getByTestId('history-open-901'));
  fireEvent.click(screen.getByTestId('order-modal-receipt'));
  expect(screen.queryByTestId('order-modal')).toBeNull();
  expect(screen.getByTestId('receipt-reprint').textContent).toBe('Reprint 1');
  expect(send).not.toHaveBeenCalled();
});
