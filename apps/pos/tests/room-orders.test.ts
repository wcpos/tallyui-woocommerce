const savedTimezone = process.env.TZ;
process.env.TZ = 'America/Los_Angeles';

import { afterAll, expect, test } from 'vitest';
import type { StoreOrder } from '@tallyui/core';
import type { PosOrder } from '@tallyui/pos';
import { mergeRoomOrders } from '../lib/reports/room-orders';
import { salesRoom, salesRoomOf } from '../lib/reports/sales-room';

afterAll(() => {
  if (savedTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = savedTimezone;
});

const now = new Date(2026, 9, 6, 14, 30);
const day = { range: { from: '2026-10-06', to: '2026-10-06' }, preset: 'today' as const, comparison: { from: '2026-10-05', to: '2026-10-05' } };
const ts = (h: number, m: number) => new Date(2026, 9, 6, h, m).toISOString();
const base: Omit<PosOrder, 'id' | 'totalMinor' | 'payments' | 'syncStatus'> = {
  createdAt: ts(9, 10), updatedAt: now.toISOString(),
  currency: 'USD', pricesIncludeTax: false, lines: [], subtotalMinor: 0, discountMinor: 0,
  taxMinor: 0, customer: null, commandId: 'command', taxRounding: { granularity: 'per_line_items', mode: 'half_up' },
};
const local: PosOrder[] = [
  { ...base, id: 'L1', createdAt: ts(9, 10), syncStatus: 'applied', totalMinor: 11000, cashierRef: '7',
    payments: [{ id: 'p1', method: 'cash', amountMinor: 11000 }] },
  { ...base, id: 'L2', createdAt: ts(11, 0), syncStatus: 'pending', totalMinor: 3300, taxMinor: 300, cashierRef: '7',
    lines: [{ id: 'l2', productId: 'product2', name: 'Item 2', sku: 'sku2', quantity: 1,
      unitPriceMinor: 3000, discountMinor: 0, netMinor: 3000,
      taxLines: [{ ratePpm: 100000, taxMicros: '300000000' }] }],
    payments: [{ id: 'p2', method: 'cash', amountMinor: 3300 }] },
  { ...base, id: 'L3', createdAt: ts(11, 30), syncStatus: 'rejected', totalMinor: 1200,
    payments: [{ id: 'p3', method: 'cash', amountMinor: 1200 }] },
  { ...base, id: 'L4', createdAt: ts(12, 0), syncStatus: 'applied', totalMinor: 2200, taxMinor: 200, cashierRef: '7',
    lines: [{ id: 'l4', productId: 'product4', name: 'Item 4', sku: 'sku4', quantity: 2,
      unitPriceMinor: 1000, discountMinor: 0, netMinor: 2000,
      taxLines: [{ ratePpm: 100000, taxMicros: '200000000' }] }],
    payments: [{ id: 'p4', method: 'external', amountMinor: 2200 }] },
];
const storeBase: Omit<StoreOrder, 'id' | 'status' | 'placedAt' | 'totalMinor'> = {
  reference: 'store-order', pricesIncludeTax: false, customer: null, lines: [], fees: [], shipping: [],
  coupons: [], taxLines: [], discountMinor: 0, discountTaxMinor: 0, taxMinor: 0, payments: [], refunds: [], currency: 'USD',
};
const store: StoreOrder[] = [
  { ...storeBase, id: 'S1', status: 'completed', placedAt: ts(10, 40), totalMinor: 11000, taxMinor: 1000, clientOrderId: 'L1',
    lines: [{ id: 's1', name: 'Item 1', quantity: 2, subtotalMinor: 10000, subtotalTaxMinor: 1000, totalMinor: 10000, taxMinor: 1000 }],
    taxLines: [{ label: 'State', ratePpm: 100000, amountMinor: 1000 }],
    payments: [{ method: 'pos_cash', kind: 'cash', amountMinor: 11000 }], refunds: [{ id: 'r1', amountMinor: 2000 }] },
  { ...storeBase, id: 'S2', status: 'processing', placedAt: ts(13, 0), totalMinor: 5000, taxMinor: 500,
    taxLines: [{ label: 'State', ratePpm: 100000, amountMinor: 500 }],
    payments: [{ method: 'stripe', title: 'Credit card', amountMinor: 5000 }] },
  { ...storeBase, id: 'S3', status: 'cancelled', placedAt: ts(10, 0), totalMinor: 3000 },
  { ...storeBase, id: 'S4', status: 'refunded', placedAt: ts(10, 30), totalMinor: 4000, refunds: [{ id: 'r4', amountMinor: 4000 }] },
  { ...storeBase, id: 'S5', status: 'pending', placedAt: ts(13, 30), totalMinor: 2500 },
];

test('done mode joins store and local sales, retaining local time and cashier and counting refunds separately', () => {
  const room = salesRoomOf(mergeRoomOrders(store, local, 'done'), { now, currency: 'USD', ...day });
  expect(room.today).toMatchObject({
    count: 4, totalMinor: 21500, taxMinor: 2000,
    refundedMinor: 6000, refundedOrders: 2,
    pending: 1, rejected: 1, rejectedCashMinor: 1200,
  });
  expect(room.today.byMethod).toEqual(expect.arrayContaining([
    { method: 'cash', label: 'Cash', count: 2, totalMinor: 14300 },
    { method: 'external', label: 'Card terminal', count: 1, totalMinor: 2200 },
    { method: 'stripe', label: 'Credit card', count: 1, totalMinor: 5000 },
  ]));
  expect(room.today.byMethod).toHaveLength(3);
  expect(room.today.byCashier).toEqual([
    { cashierRef: '7', count: 3, totalMinor: 16500 },
    { cashierRef: '', count: 1, totalMinor: 5000 },
  ]);
  expect(room.today.taxRates).toEqual([
    { ratePpm: 100000, label: 'State', netMinor: null, taxMinor: 2000, grossMinor: null },
  ]);
  expect(room.hours.find(bucket => bucket.minute === 540)?.today.totalMinor).toBe(11000);
});

test('all mode also counts pending store orders and their unpaid amount', () => {
  const room = salesRoomOf(mergeRoomOrders(store, local, 'all'), { now, currency: 'USD', ...day });
  expect(room.today).toMatchObject({ count: 5, totalMinor: 24000, refundedMinor: 6000 });
  expect(room.today.byMethod).toEqual(expect.arrayContaining([
    { method: 'unpaid', label: 'Unpaid', count: 1, totalMinor: 2500 },
  ]));
});

test('a local-only merge equals salesRoom without double counting', () => {
  const options = { now, currency: 'USD', ...day };
  const room = salesRoomOf(mergeRoomOrders([], local, 'done'), options);
  expect(room).toEqual(salesRoom(local, options));
  expect(room.today.count).toBe(3);
});

test('an unreadable payment record is Not read, and a readable partial payment leaves Unpaid', () => {
  const order: StoreOrder = {
    ...storeBase, id: 'unreadable', status: 'processing', placedAt: ts(13, 0), totalMinor: 1000,
    paymentRecordUnreadable: true,
  };
  const options = { now, currency: 'USD', ...day };
  expect(salesRoomOf(mergeRoomOrders([order], [], 'done'), options).today.byMethod).toEqual([
    { method: 'unknown', label: 'Not read', count: 1, totalMinor: 1000 },
  ]);
  const { paymentRecordUnreadable, ...readable } = order;
  const paid: StoreOrder = {
    ...readable, status: 'completed', payments: [{ method: 'pos_cash', kind: 'cash', amountMinor: 700 }],
  };
  expect(salesRoomOf(mergeRoomOrders([paid], [], 'done'), options).today.byMethod).toEqual([
    { method: 'cash', label: 'Cash', count: 1, totalMinor: 700 },
    { method: 'unpaid', label: 'Unpaid', count: 1, totalMinor: 300 },
  ]);
});

test("a tax rate takes the store's label even when a stand-in label came first", () => {
  const A: StoreOrder = {
    ...storeBase, id: 'A', status: 'completed', placedAt: ts(13, 0), totalMinor: 1100, taxMinor: 100,
    taxLines: [{ label: '', ratePpm: 100000, amountMinor: 100 }],
  };
  const B: StoreOrder = {
    ...storeBase, id: 'B', status: 'completed', placedAt: ts(13, 0), totalMinor: 2200, taxMinor: 200,
    taxLines: [{ label: 'State', ratePpm: 100000, amountMinor: 200 }],
  };
  expect(salesRoomOf(mergeRoomOrders([A, B], [], 'done'), { now, currency: 'USD', ...day }).today.taxRates).toEqual([
    { ratePpm: 100000, label: 'State', netMinor: null, taxMinor: 300, grossMinor: null },
  ]);
});

test("an on-hold or cancelled store order's refund counts in both modes, though the order does not", () => {
  const H: StoreOrder = {
    ...storeBase, id: 'H', status: 'on-hold', placedAt: ts(13, 0), totalMinor: 3000,
    refunds: [{ id: 'rh', amountMinor: 500 }],
  };
  const C: StoreOrder = {
    ...storeBase, id: 'C', status: 'cancelled', placedAt: ts(13, 0), totalMinor: 2000,
    refunds: [{ id: 'rc', amountMinor: 700 }],
  };
  const options = { now, currency: 'USD', ...day };
  expect(salesRoomOf(mergeRoomOrders([H, C], [], 'done'), options).today).toMatchObject({
    count: 0, totalMinor: 0, refundedMinor: 1200, refundedOrders: 2,
  });
  expect(salesRoomOf(mergeRoomOrders([H, C], [], 'all'), options).today).toMatchObject({
    count: 1, totalMinor: 3000, refundedMinor: 1200, refundedOrders: 2,
  });
});
