const savedTimezone = process.env.TZ;
process.env.TZ = 'America/Los_Angeles';

import { afterAll, expect, test } from 'vitest';
import { formatMoney } from '@tallyui/core';
import type { PosOrder } from '@tallyui/pos';
import { salesRoom, type Period } from '../lib/reports/sales-room';
import { productFigures } from '../lib/reports/product-figures';
import { cashierLabel, cashiersTable, categoriesTable, ordersTable, paymentsTable, productsTable, taxesTable, whereSoldTable } from '../lib/reports/sales-tables';
import { salesTableCsv } from '../lib/reports/sales-table-csv';

afterAll(() => {
  if (savedTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = savedTimezone;
});

const now = new Date(2026, 9, 6, 14, 30);
/** Today, 6 Oct, against yesterday. */
const day = { range: { from: '2026-10-06', to: '2026-10-06' }, preset: 'today' as const, comparison: { from: '2026-10-05', to: '2026-10-05' } };
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
const today = salesRoom(orders, { now, currency: 'USD', ...day }).today;

test('payments table sorts by amount and shares the period total', () => {
  const table = paymentsTable(today, money);
  expect(table.rows.map(row => row.cells)).toEqual([
    ['Card terminal', '2', '$22.38', '74.7%'], ['Cash', '3', '$7.58', '25.3%'],
  ]);
  expect(table.total).toEqual(['Total', '4', '$29.96', '']);
  expect(table.status).toBe('4 orders · $29.96');
  expect(table.title).toBe('Sales by payment method');
}, 20_000);

test("where sold table is one In store row with the period's orders and total", () => {
  const table = whereSoldTable(today, money);
  expect(table.rows.map(row => row.cells)).toEqual([['In store', '4', '$29.96', '100.0%']]);
  expect(table.rows[0].key).toBe('store');
  expect(table.total).toEqual(['Total', '4', '$29.96', '100.0%']);
  expect(table.head).toEqual(['Channel', 'Orders', 'Amount', 'Share']);
  expect(table.title).toBe('Channels');
  expect(table.status).toBe('4 orders · $29.96');
}, 20_000);

test('where sold table has no rows in an empty period', () => {
  const empty = salesRoom([], { now, currency: 'USD', ...day }).today;
  const table = whereSoldTable(empty, money);
  expect(table.rows).toEqual([]);
  expect(table.total).toEqual(['Total', '0', '$0.00', '']);
  expect(table.status).toBe('0 orders · $0.00');
}, 20_000);

test('where sold share is a dash when the orders total nothing', () => {
  const period: Period = { ...today, count: 1, totalMinor: 0 };
  const table = whereSoldTable(period, money);
  expect(table.rows.map(row => row.cells)).toEqual([['In store', '1', '$0.00', '—']]);
  expect(table.total[3]).toBe('—');
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
  const empty = salesRoom([], { now, currency: 'USD', ...day }).today;
  const payments = paymentsTable(empty, money);
  expect(payments.rows).toEqual([]);
  expect(payments.total).toEqual(['Total', '0', '$0.00', '']);
  expect(payments.status).toBe('0 orders · $0.00');
  expect(taxesTable(empty, money).rows).toEqual([]);
}, 20_000);

test('each table has its own empty line, from v2, with no full stop', () => {
  const empty = salesRoom([], { now, currency: 'USD', ...day }).today;
  expect(paymentsTable(empty, money).empty).toBe('No payments in this period');
  expect(whereSoldTable(empty, money).empty).toBe('No sales in this period');
  expect(taxesTable(empty, money).empty).toBe('No sales in this period');
  expect(ordersTable([], { range: day.range, currency: 'USD', money }).empty).toBe('No orders in this period');
});

test('heads and alignment', () => {
  const payments = paymentsTable(today, money);
  const taxes = taxesTable(today, money);
  expect(payments.head).toEqual(['Method', 'Orders', 'Amount', 'Share']);
  expect(taxes.head).toEqual(['Rate', 'Net', 'Tax', 'Gross']);
  expect(payments.align).toEqual(['left', 'right', 'right', 'right']);
  expect(taxes.align).toEqual(['left', 'right', 'right', 'right']);
}, 20_000);

test("orders table lists today's orders newest first in the store currency", () => {
  const table = ordersTable(orders, { range: day.range, currency: 'USD', money });
  expect(table.rows.map(row => row.cells)).toEqual([
    ['T4', '13:50', 'Unknown', 'Cash', '$1.00', 'Yes'],
    ['T3', '13:05', 'Unknown', 'Card terminal', '$17.38', 'Yes'],
    ['T2', '09:40', 'Unknown', 'Cash + Card terminal', '$8.58', 'Yes'],
    ['T1', '09:15', 'Unknown', 'Cash', '$3.00', 'Yes'],
  ]);
  expect(table.total).toEqual(['Counted', '', '', '', '$29.96', '']);
  expect(table.status).toBe('4 of 4 counted');
  expect(table.title).toBe('Orders');
}, 20_000);

// v2 panels/specs.ts:190 `[col.order, col.time, col.cashier, col.paidBy, total, col.counted]`, aligned by :134-136.
test("orders table head reads v2's Order, Time, Cashier, Paid by, Total, Counted", () => {
  const table = ordersTable(orders, { range: day.range, currency: 'USD', money });
  expect(table.head).toEqual(['Order', 'Time', 'Cashier', 'Paid by', 'Total', 'Counted']);
  expect(table.align).toEqual(['left', 'left', 'left', 'left', 'right', 'left']);
}, 20_000);

test("orders table names each order's cashier as the Cashiers table does", () => {
  const cashiers = [{ id: '2', name: 'Paul' }];
  const named = orders.map(order => order.id === 'T4' ? { ...order, cashierRef: '2' } : order.id === 'T3' ? { ...order, cashierRef: '9' } : order);
  const table = ordersTable(named, { range: day.range, currency: 'USD', money, cashiers });
  const cashier = table.head.indexOf('Cashier');
  expect(table.rows.map(row => [row.key, row.cells[cashier]])).toEqual([['T4', 'Paul'], ['T3', 'Cashier #9'], ['T2', 'Unknown'], ['T1', 'Unknown']]);
  for (const row of table.rows) {
    expect(row.cells[cashier]).toBe(cashierLabel(cashiers, named.find(order => order.id === row.key)?.cashierRef ?? ''));
  }
}, 20_000);

// v2 panels/specs.ts:221: the footer's amount sits under Total; Counted stays last so the ticks replace it on screen.
test('orders table total keeps Total under Total and Counted last', () => {
  const table = ordersTable(orders, { range: day.range, currency: 'USD', money });
  expect(table.total).toEqual(['Counted', '', '', '', '$29.96', '']);
  expect(table.total).toHaveLength(table.head.length);
  expect(table.total.indexOf('$29.96')).toBe(table.head.indexOf('Total'));
  expect(table.head.at(-1)).toBe('Counted');
}, 20_000);

// v2 panels/specs.ts:188-222 and panel.tsx:254-259: a left-out order stays a row, Counted "No", out of the footer sum.
test('orders table keeps a left-out order as a row with Counted No and sums only the counted ones', () => {
  const table = ordersTable(orders, { range: day.range, currency: 'USD', money, leftOut: new Set(['T3', 'elsewhere']) });
  expect(table.rows.map(row => [row.key, row.cells[5]])).toEqual([['T4', 'Yes'], ['T3', 'No'], ['T2', 'Yes'], ['T1', 'Yes']]);
  expect(table.total).toEqual(['Counted', '', '', '', '$12.58', '']);
  expect(table.status).toBe('3 of 4 counted · the numbers follow');
  const csv = salesTableCsv(table).split('\r\n');
  expect(csv[0]).toBe('"Order","Time","Cashier","Paid by","Total","Counted"');
  expect(csv[2]).toBe('"T3","13:05","Unknown","Card terminal","$17.38","No"');
}, 20_000);

test('orders table names a method once however many legs it has', () => {
  const extra: PosOrder = { ...base, id: 'C1', createdAt: new Date(2026, 9, 6, 11, 0).toISOString(),
    totalMinor: 500, syncStatus: 'applied',
    payments: [{ id: 'cash-1', method: 'cash', amountMinor: 300 }, { id: 'cash-2', method: 'cash', amountMinor: 200 }] };
  const table = ordersTable([...orders, extra], { range: day.range, currency: 'USD', money });
  expect(table.rows.find(row => row.key === 'C1')?.cells[3]).toBe('Cash');
}, 20_000);

test("orders table shows the store's display id once synced", () => {
  const synced = orders.map(order => order.id === 'T3'
    ? { ...order, serverRefs: { orderId: '115', displayId: '115', totalMinor: 1738 } } : order);
  const table = ordersTable(synced, { range: day.range, currency: 'USD', money });
  expect(table.rows.find(row => row.key === 'T3')?.cells[0]).toBe('T3 · #115');
}, 20_000);

test('orders table with no orders today', () => {
  const table = ordersTable([], { range: day.range, currency: 'USD', money });
  expect(table.rows).toEqual([]);
  expect(table.total).toEqual(['Counted', '', '', '', '$0.00', '']);
  expect(table.status).toBe('0 of 0 counted');
}, 20_000);

test('products table lists every product with its units and an All products total', () => {
  const table = productsTable(today, productFigures(orders, { currency: 'USD', range: day.range }), money);
  expect(table.title).toBe('Top products');
  expect(table.head).toEqual(['Product', 'Qty', 'Amount']);
  expect(table.align).toEqual(['left', 'right', 'right']);
  expect(table.rows.map(row => [row.key, ...row.cells])).toEqual([
    ['product3', 'Item 3', '1', '$17.38'], ['product2', 'Item 2', '1', '$8.58'],
  ]);
  // v2 specs.ts:244: the rows carry line totals, so the total is theirs, not the orders'.
  expect(table.total).toEqual(['All products', '2', '$25.96']);
  expect(table.status).toBe('4 orders · $29.96');
  expect(table.empty).toBe('No sales in this period');
}, 20_000);

test('categories table shares the period total and totals the parts', () => {
  const categories = { unknownLines: 1, totalLines: 3, parts: [
    { key: '25', label: 'Coffee', amountMinor: 1738, quantity: 2 },
    { key: 'unknown', label: 'Unknown product', amountMinor: 858, quantity: 1 },
  ] };
  const table = categoriesTable(today, categories, money);
  expect(table.title).toBe('Sales by category');
  expect(table.head).toEqual(['Category', 'Qty', 'Amount', 'Share']);
  expect(table.align).toEqual(['left', 'right', 'right', 'right']);
  // v2 cards/aggregate.ts categories: a part's share is of the period's total ($29.96), as on the card's donut.
  expect(table.rows.map(row => [row.key, ...row.cells])).toEqual([
    ['25', 'Coffee', '2', '$17.38', '58.0%'], ['unknown', 'Unknown product', '1', '$8.58', '28.6%'],
  ]);
  expect(table.total).toEqual(['Total', '3', '$25.96', '']);
  expect(table.status).toBe('4 orders · $29.96');
  expect(categoriesTable({ ...today, totalMinor: 0 }, categories, money).rows[0].cells[3]).toBe('—');
}, 20_000);

test('cashiers table averages each cashier and totals the period', () => {
  const period: Period = { ...today, count: 4, totalMinor: 1100, averageMinor: 275, byCashier: [
    { cashierRef: '7', count: 2, totalMinor: 701 },
    { cashierRef: '', count: 1, totalMinor: 299 },
    { cashierRef: '42', count: 1, totalMinor: 100 },
  ] };
  const table = cashiersTable(period, [{ id: '7', name: 'Alex' }], money);
  expect(table.title).toBe('Sales by cashier');
  expect(table.head).toEqual(['Cashier', 'Orders', 'Avg order', 'Amount']);
  expect(table.align).toEqual(['left', 'right', 'right', 'right']);
  // v2 specs.ts:349: a row's average is its amount over its orders, to the minor unit.
  expect(table.rows.map(row => [row.key, ...row.cells])).toEqual([
    ['7', 'Alex', '2', '$3.51', '$7.01'],
    ['unknown', 'Unknown', '1', '$2.99', '$2.99'],
    ['42', 'Cashier #42', '1', '$1.00', '$1.00'],
  ]);
  expect(table.total).toEqual(['Total', '4', '$2.75', '$11.00']);
  expect(table.status).toBe('4 orders · $11.00');
  expect(table.empty).toBe('No sales in this period');
}, 20_000);
