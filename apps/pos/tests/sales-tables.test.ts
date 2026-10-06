const savedTimezone = process.env.TZ;
process.env.TZ = 'America/Los_Angeles';

import { afterAll, expect, test } from 'vitest';
import { formatMoney } from '@tallyui/core';
import type { PosOrder } from '@tallyui/pos';
import { salesRoom } from '../lib/reports/sales-room';
import { ordersTable, paymentsTable, taxesTable } from '../lib/reports/sales-tables';

afterAll(() => {
  if (savedTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = savedTimezone;
});

const now = new Date(2026, 9, 6, 14, 30);
const base: Omit<PosOrder, 'id' | 'totalMinor' | 'payments' | 'syncStatus'> = {
  createdAt: new Date(2026, 9, 6, 9, 15).toISOString(), updatedAt: now.toISOString(),
  currency: 'USD', pricesIncludeTax: false, lines: [], subtotalMinor: 0, discountMinor: 0,
  taxMinor: 0, customer: null, commandId: 'command', taxRounding: { granularity: 'per_line_items', mode: 'half_up' },
};
const orders: PosOrder[] = [
  { ...base, id: 'T1', createdAt: new Date(2026, 9, 6, 9, 15).toISOString(),
    subtotalMinor: 300, totalMinor: 300, syncStatus: 'applied',
    payments: [{ id: 'p1', method: 'cash', amountMinor: 300, tenderedMinor: 1000, changeMinor: 700 }] },
  { ...base, id: 'T2', createdAt: new Date(2026, 9, 6, 9, 40).toISOString(),
    subtotalMinor: 800, totalMinor: 858, taxMinor: 58, syncStatus: 'pending',
    lines: [{ id: 'l2', productId: 'product2', name: 'Item 2', sku: 'sku2', quantity: 1,
      unitPriceMinor: 800, discountMinor: 0, netMinor: 800,
      taxLines: [{ ratePpm: 72500, taxMicros: '58000000' }] }],
    payments: [{ id: 'p2', method: 'cash', amountMinor: 358 }, { id: 'p3', method: 'external', amountMinor: 500 }] },
  { ...base, id: 'T3', createdAt: new Date(2026, 9, 6, 13, 5).toISOString(),
    subtotalMinor: 1600, totalMinor: 1738, taxMinor: 138, syncStatus: 'applied',
    lines: [{ id: 'l3', productId: 'product3', name: 'Item 3', sku: 'sku3', quantity: 1,
      unitPriceMinor: 1600, discountMinor: 0, netMinor: 1600,
      taxLines: [{ ratePpm: 72500, taxMicros: '116000000' }, { ratePpm: 13750, taxMicros: '22000000' }] }],
    payments: [{ id: 'p4', method: 'external', amountMinor: 1738 }] },
  { ...base, id: 'T4', createdAt: new Date(2026, 9, 6, 13, 50).toISOString(),
    subtotalMinor: 100, totalMinor: 100, syncStatus: 'rejected',
    payments: [{ id: 'p5', method: 'cash', amountMinor: 100 }] },
  { ...base, id: 'Y1', createdAt: new Date(2026, 9, 5, 11, 20).toISOString(),
    subtotalMinor: 400, totalMinor: 400, syncStatus: 'applied',
    payments: [{ id: 'p6', method: 'cash', amountMinor: 400 }] },
  { ...base, id: 'Y2', createdAt: new Date(2026, 9, 5, 16, 45).toISOString(),
    subtotalMinor: 600, totalMinor: 600, syncStatus: 'applied',
    payments: [{ id: 'p7', method: 'external', amountMinor: 600 }] },
  { ...base, id: 'X1', createdAt: new Date(2026, 9, 6, 10, 0).toISOString(), currency: 'EUR',
    subtotalMinor: 999, totalMinor: 999, syncStatus: 'applied',
    payments: [{ id: 'p8', method: 'cash', amountMinor: 999 }] },
  { ...base, id: 'X2', createdAt: new Date(2026, 9, 4, 23, 59).toISOString(),
    subtotalMinor: 5000, totalMinor: 5000, syncStatus: 'applied',
    payments: [{ id: 'p9', method: 'cash', amountMinor: 5000 }] },
  { ...base, id: 'X3', createdAt: new Date(2026, 9, 7, 0, 0).toISOString(),
    subtotalMinor: 7000, totalMinor: 7000, syncStatus: 'applied',
    payments: [{ id: 'p10', method: 'cash', amountMinor: 7000 }] },
];

const money = (n: number) => formatMoney({ amount: n, currency: 'USD' }, 'en-US');
const today = salesRoom(orders, { now, currency: 'USD' }).today;

test('payments table sorts by amount and shares the period total', () => {
  const table = paymentsTable(today, money);
  expect(table.rows.map(row => row.cells)).toEqual([
    ['Card terminal', '2', '$22.38', '74.7%'], ['Cash', '3', '$7.58', '25.3%'],
  ]);
  expect(table.total).toEqual(['Total', '4', '$29.96', '']);
  expect(table.status).toBe('4 orders · $29.96');
  expect(table.title).toBe('Sales by payment method');
}, 20_000);

test('taxes table lists rates ascending and totals the period, not the rows', () => {
  const table = taxesTable(today, money);
  expect(table.rows.map(row => row.cells)).toEqual([
    ['Tax 1.375%', '$16.00', '$0.22', '$16.22'], ['Tax 7.25%', '$24.00', '$1.74', '$25.74'],
  ]);
  expect(table.total).toEqual(['Total', '$28.00', '$1.96', '$29.96']);
  expect(table.title).toBe('Taxes collected');
}, 20_000);

test('an empty period has no rows and a zero total', () => {
  const empty = salesRoom([], { now, currency: 'USD' }).today;
  const payments = paymentsTable(empty, money);
  expect(payments.rows).toEqual([]);
  expect(payments.total).toEqual(['Total', '0', '$0.00', '']);
  expect(payments.status).toBe('0 orders · $0.00');
  expect(taxesTable(empty, money).rows).toEqual([]);
}, 20_000);

test('heads and alignment', () => {
  const payments = paymentsTable(today, money);
  const taxes = taxesTable(today, money);
  expect(payments.head).toEqual(['Method', 'Orders', 'Amount', 'Share']);
  expect(taxes.head).toEqual(['Rate', 'Net', 'Tax', 'Gross']);
  expect(payments.align).toEqual(['left', 'right', 'right', 'right']);
  expect(taxes.align).toEqual(['left', 'right', 'right', 'right']);
}, 20_000);

test("orders table lists today's orders newest first in the store currency", () => {
  const table = ordersTable(orders, { now, currency: 'USD', money });
  expect(table.rows.map(row => row.cells)).toEqual([
    ['T4', '13:50', 'Cash', '$1.00'],
    ['T3', '13:05', 'Card terminal', '$17.38'],
    ['T2', '09:40', 'Cash + Card terminal', '$8.58'],
    ['T1', '09:15', 'Cash', '$3.00'],
  ]);
  expect(table.total).toEqual(['Total', '', '', '$29.96']);
  expect(table.status).toBe('4 orders · $29.96');
  expect(table.title).toBe('Orders');
  expect(table.head).toEqual(['Order', 'Time', 'Paid by', 'Total']);
  expect(table.align).toEqual(['left', 'left', 'left', 'right']);
}, 20_000);

test('orders table names a method once however many legs it has', () => {
  const extra: PosOrder = { ...base, id: 'C1', createdAt: new Date(2026, 9, 6, 11, 0).toISOString(),
    totalMinor: 500, syncStatus: 'applied',
    payments: [{ id: 'cash-1', method: 'cash', amountMinor: 300 }, { id: 'cash-2', method: 'cash', amountMinor: 200 }] };
  const table = ordersTable([...orders, extra], { now, currency: 'USD', money });
  expect(table.rows.find(row => row.key === 'C1')?.cells[2]).toBe('Cash');
}, 20_000);

test("orders table shows the store's display id once synced", () => {
  const synced = orders.map(order => order.id === 'T3'
    ? { ...order, serverRefs: { orderId: '115', displayId: '115', totalMinor: 1738 } } : order);
  const table = ordersTable(synced, { now, currency: 'USD', money });
  expect(table.rows.find(row => row.key === 'T3')?.cells[0]).toBe('T3 · #115');
}, 20_000);

test('orders table with no orders today', () => {
  const table = ordersTable([], { now, currency: 'USD', money });
  expect(table.rows).toEqual([]);
  expect(table.total).toEqual(['Total', '', '', '$0.00']);
  expect(table.status).toBe('0 orders · $0.00');
}, 20_000);
