import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import type { StoreOrder } from '@tallyui/core';
import type { PosOrder } from '@tallyui/pos';
import { OrdersTable } from '../components/orders-table';
import { CARD_CLASSES, classesOf } from './classes-of';
import { dateTimeLabel, dayHeading, dayLabel, orderRowCells, orderTableItems, storeTone } from '../lib/orders/order-days';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const setWidth = (width: number) => vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 844, scale: 1, fontScale: 1 });
// jsdom's window is narrower than NARROW_WIDTH, so every test starts on the wide table; the phone tests set 390.
beforeEach(() => { setWidth(1280); });

const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m - 1, d, h, min).toISOString();
const now = new Date(2026, 10, 10, 15, 0); // Tuesday 10 Nov 2026, 15:00 local
const storeOrder: StoreOrder = {
  id: '901', reference: '901', status: 'on-hold', placedAt: at(2026, 11, 10, 10, 0),
  currency: 'USD', pricesIncludeTax: false, customer: null,
  lines: [{ id: '1', name: 'Espresso', quantity: 2, subtotalMinor: 600, subtotalTaxMinor: 0, totalMinor: 600, taxMinor: 0 }],
  fees: [], shipping: [], coupons: [], taxLines: [], refunds: [],
  payments: [{ method: 'pos_cash', title: 'Cash', kind: 'cash', amountMinor: 600 }],
  discountMinor: 0, discountTaxMinor: 0, taxMinor: 0, totalMinor: 600,
};
const posOrder = (over: Partial<PosOrder>): PosOrder => ({
  id: 'abcdef0123456789', createdAt: at(2026, 11, 10, 14, 41), currency: 'USD', pricesIncludeTax: false, lines: [],
  subtotalMinor: 300, discountMinor: 0, taxMinor: 0, totalMinor: 300, payments: [], customer: null,
  syncStatus: 'pending', commandId: 'c1', ...over,
} as unknown as PosOrder);
const shape = (items: ReturnType<typeof orderTableItems>) =>
  items.map(item => (item.type === 'day' ? `day:${item.label}` : `${item.kind}:${item.order.id}`));

test("dayHeading says Today, Yesterday, then v2's long date", () => {
  expect(dayHeading('2026-11-10', now)).toBe('Today');
  expect(dayHeading('2026-11-09', now)).toBe('Yesterday');
  expect(dayHeading('2026-11-07', now)).toBe('Saturday, 7 Nov 2026');
  expect(dayHeading('2026-11-30', new Date(2026, 11, 1, 9, 0))).toBe('Yesterday');
});

test("dayLabel reads v2's day: Today, Yesterday, else EEE d MMM", () => {
  expect(dayLabel(at(2026, 11, 10, 14, 41), now)).toBe('Today');
  expect(dayLabel(at(2026, 11, 9, 9, 5), now)).toBe('Yesterday');
  expect(dayLabel(at(2026, 11, 7, 14, 41), now)).toBe('Sat 7 Nov');
  expect(dayLabel('nope', now)).toBe('');
});

test("dateTimeLabel reads day · HH:mm like v2's Date Created cell", () => {
  expect(dateTimeLabel(at(2026, 11, 10, 14, 41), now)).toBe('Today · 14:41');
  expect(dateTimeLabel(at(2026, 11, 9, 9, 5), now)).toBe('Yesterday · 09:05');
  expect(dateTimeLabel(at(2026, 11, 7, 14, 41), now)).toBe('Sat 7 Nov · 14:41');
  expect(dateTimeLabel('nope', now)).toBe('');
});

test('orders run newest first under one heading per local day', () => {
  const items = orderTableItems([posOrder({ id: 'local-1' })],
    [storeOrder, { ...storeOrder, id: '900', reference: '900', placedAt: at(2026, 11, 9, 18, 30) }], now);
  expect(shape(items)).toEqual(['day:Today', 'local:local-1', 'store:901', 'day:Yesterday', 'store:900']);
  expect(items.flatMap(item => (item.type === 'day' ? [item.day] : []))).toEqual(['2026-11-10', '2026-11-09']);
});

test("a till sale the store already lists shows once, as the store's row", () => {
  expect(shape(orderTableItems([posOrder({ id: 'local-1' })],
    [{ ...storeOrder, id: '950', reference: '950', clientOrderId: 'local-1' }], now))).toEqual(['day:Today', 'store:950']);
});

test('status tones follow v2', () => {
  expect(storeTone('completed')).toBe('ok');
  expect(storeTone('processing')).toBe('info');
  expect(storeTone('pos-open')).toBe('info');
  expect(storeTone('on-hold')).toBe('warning');
  expect(storeTone('pending')).toBe('warning');
  expect(storeTone('pos-partial')).toBe('warning');
  expect(storeTone('failed')).toBe('bad');
  expect(storeTone('cancelled')).toBe('muted');
  expect(storeTone('refunded')).toBe('muted');
  expect(storeTone('trash')).toBe('muted');
  expect(storeTone('checkout-draft')).toBe('default');
});

test('a store row fills Status, Order Number, Customer, Date Created, Payment Method and Total', () => {
  expect(orderRowCells({ kind: 'store', order: storeOrder }, now)).toEqual({
    statusLabel: 'On hold', tone: 'warning', number: '901', customer: 'Guest', date: 'Today · 10:00', day: 'Today', payment: 'Cash', total: '$6.00',
  });
});

test('a till row names its largest payment and its sync state', () => {
  expect(orderRowCells({ kind: 'local', order: posOrder({ syncStatus: 'rejected', customer: { name: 'Brenda Walsh' },
    payments: [{ id: 'p1', method: 'cash', amountMinor: 100 }, { id: 'p2', method: 'external', amountMinor: 200 }] as PosOrder['payments'] }) }, now))
    .toEqual({ statusLabel: 'Not accepted', tone: 'bad', number: '23456789', customer: 'Brenda Walsh', date: 'Today · 14:41', day: 'Today', payment: 'Card', total: '$3.00' });
  expect(orderRowCells({ kind: 'local', order: posOrder({}) }, now).payment).toBe('');
});

test("a till row's day comes from its createdAt", () => {
  const cells = orderRowCells({ kind: 'local', order: posOrder({ createdAt: at(2026, 11, 9, 9, 5) }) }, now);
  expect(cells.day).toBe('Yesterday');
  expect(cells.date).toBe('Yesterday · 09:05');
});

test("the table shows v2's columns, a day band and a count, and the chevron opens the order", () => {
  const onOpen = vi.fn();
  render(<OrdersTable local={[]} store={[storeOrder]} onOpen={onOpen} now={() => now} />);
  for (const h of ['Status', 'Order Number', 'Customer', 'Date Created', 'Payment Method', 'Total']) {
    expect(screen.getByText(h)).not.toBeNull();
  }
  expect(screen.getByTestId('orders-day-heading-2026-11-10').textContent).toBe('Today');
  const row = within(screen.getByTestId('history-row-901'));
  for (const text of ['On hold', '901', 'Guest', 'Today · 10:00', 'Cash', '$6.00']) {
    expect(row.getByText(text)).not.toBeNull();
  }
  expect(screen.getByTestId('data-table-count').textContent).toBe('Showing 1');
  fireEvent.click(screen.getByTestId('history-open-901'));
  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ kind: 'store', order: storeOrder }));
});

test("at 1280 the orders table sits on the areas' shared card, with the count under it", () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1280, height: 800, scale: 1, fontScale: 1 });
  render(<OrdersTable local={[]} store={[storeOrder]} onOpen={vi.fn()} now={() => now} />);
  const surface = screen.getByTestId('orders-table-surface');
  expect(classesOf('orders-table-surface')).toEqual(expect.arrayContaining(CARD_CLASSES));
  expect(surface.contains(screen.getByTestId('orders-table'))).toBe(true);
  expect(surface.contains(screen.getByTestId('data-table-count'))).toBe(false);
});

test("v2's 32 px customer chip, a centred order number and Date Created's down chevron for newest first", () => {
  render(<OrdersTable local={[]} store={[storeOrder]} onOpen={vi.fn()} now={() => now} />);
  // v2's Chip size="sm" (components chip/index.tsx:125, 158): h-8, px-2.5, a text-sm (13 px) label.
  expect(classesOf('history-901-customer-chip')).toEqual(expect.arrayContaining(['h-8', 'px-2.5']));
  expect(classesOf('history-901-customer-chip')).not.toContain('py-0.5');
  expect(screen.getByTestId('history-901-customer').textContent).toBe('Guest');
  expect(classesOf('history-901-customer')).toContain('text-sm');
  expect(classesOf('history-901-customer')).not.toContain('text-xs');
  expect(screen.getByTestId('history-901-number').textContent).toBe('901');
  expect(classesOf('history-901-number')).toContain('items-center');
  const sorted = screen.getByTestId('data-table-sort-date_created_gmt-desc');
  expect(sorted.textContent).toBe('Date Created');
  const chevron = screen.getByTestId('orders-sort-chevron');
  expect(sorted.contains(chevron)).toBe(true);
  expect(chevron.querySelector('path')?.getAttribute('d')).toBe('m6 9 6 6 6-6');
});

test("a body row is v2's 57 px order row with every cell centred on it; the day band keeps its 28 px", () => {
  render(<OrdersTable local={[]} store={[storeOrder]} onOpen={vi.fn()} now={() => now} />);
  expect(classesOf('history-row-901')).toContain('min-h-[57px]');
  for (const cell of ['status', 'number', 'date', 'payment', 'total']) {
    expect(classesOf(`history-901-${cell}`)).toEqual(expect.arrayContaining(['justify-center', 'py-1.5']));
    expect(classesOf(`history-901-${cell}`)).not.toContain('py-4');
  }
  expect(classesOf('orders-day-heading-2026-11-10')).toContain('h-7');
});

test("at 390 each order is v2's two-line phone row: number and customer, then status, day and payment, and its total", () => {
  setWidth(390);
  render(<OrdersTable local={[]} store={[{ ...storeOrder, id: '1042', reference: '1042', customer: { name: 'Brenda Walsh' } as StoreOrder['customer'] }]}
    onOpen={vi.fn()} now={() => now} />);
  expect(screen.queryByTestId('orders-table')).toBeNull();
  expect(screen.queryByText('Order Number')).toBeNull();
  expect(screen.getByTestId('history-1042-number').textContent).toBe('#1042');
  expect(screen.getByTestId('history-1042-customer').textContent).toBe('· Brenda Walsh');
  expect(screen.getByTestId('history-1042-status').textContent).toContain('On hold');
  expect(screen.getByTestId('history-1042-date').textContent).toBe('· Today');
  expect(screen.getByTestId('history-1042-payment').textContent).toBe('· Cash');
  expect(screen.getByTestId('history-1042-total').textContent).toBe('$6.00');
  expect(classesOf('history-1042-total')).toContain('tabular-nums');
  expect(screen.getByTestId('orders-day-heading-2026-11-10').textContent).toBe('Today');
  expect(screen.queryByTestId('history-open-1042')).toBeNull();
  const line1 = screen.getByTestId('history-1042-number').parentElement;
  const line2 = screen.getByTestId('history-1042-status').parentElement;
  expect(screen.getByTestId('history-1042-customer').parentElement).toBe(line1);
  expect(screen.getByTestId('history-1042-date').parentElement).toBe(line2);
  expect(screen.getByTestId('history-1042-payment').parentElement).toBe(line2);
  expect(line1).not.toBe(line2);
});

test("at 390 pressing the row opens the order, a store order and a till sale each with its own kind", () => {
  setWidth(390);
  const onOpen = vi.fn();
  render(<OrdersTable local={[posOrder({ id: 'local-1' })]} store={[storeOrder]} onOpen={onOpen} now={() => now} />);
  expect(screen.getByTestId('history-row-901').getAttribute('role')).toBe('button');
  fireEvent.click(screen.getByTestId('history-row-901'));
  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(onOpen).toHaveBeenNthCalledWith(1, expect.objectContaining({ kind: 'store', order: storeOrder }));
  fireEvent.click(screen.getByTestId('order-row-local-1'));
  expect(onOpen).toHaveBeenCalledTimes(2);
  expect(onOpen).toHaveBeenNthCalledWith(2, expect.objectContaining({ kind: 'local', order: expect.objectContaining({ id: 'local-1' }) }));
});

test("at 390 a row with no payment skips that part of line 2", () => {
  setWidth(390);
  render(<OrdersTable local={[]} store={[{ ...storeOrder, payments: [] }]} onOpen={vi.fn()} now={() => now} />);
  expect(screen.queryByTestId('history-901-payment')).toBeNull();
  expect(screen.queryByTestId('history-901-date')).not.toBeNull();
});

test("at 1280 the Date Created cell keeps the day and time", () => {
  setWidth(1280);
  render(<OrdersTable local={[]} store={[storeOrder]} onOpen={vi.fn()} now={() => now} />);
  expect(screen.getByTestId('history-901-date').textContent).toBe('Today · 10:00');
});

test("at 1280 the table and its head stay, and only the chevron opens the order", () => {
  setWidth(1280);
  const onOpen = vi.fn();
  render(<OrdersTable local={[]} store={[storeOrder]} onOpen={onOpen} now={() => now} />);
  expect(screen.getByTestId('orders-table')).not.toBeNull();
  expect(screen.getByText('Order Number')).not.toBeNull();
  fireEvent.click(screen.getByTestId('history-open-901'));
  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ kind: 'store' }));
  expect(screen.queryByTestId('orders-rows')).toBeNull();
});
