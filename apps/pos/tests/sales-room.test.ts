const savedTimezone = process.env.TZ;
process.env.TZ = 'America/Los_Angeles';

import { afterAll, expect, test } from 'vitest';
import type { PosOrder } from '@tallyui/pos';
import { salesRoom } from '../lib/reports/sales-room';

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

test('today totals every sync state in the store currency only', () => {
  expect(salesRoom(orders, { now, currency: 'USD' }).today).toMatchObject({
    count: 4, totalMinor: 2996, taxMinor: 196, averageMinor: 749, pending: 1, rejected: 1, splitCount: 1,
  });
}, 20_000);

test('a split counts once per method with its applied amounts', () => {
  expect(salesRoom(orders, { now, currency: 'USD' }).today.byMethod).toEqual([
    { method: 'cash', label: 'Cash', count: 3, totalMinor: 758 },
    { method: 'external', label: 'Card terminal', count: 2, totalMinor: 2238 },
  ]);
}, 20_000);

test('two cash legs on one order count one cash order', () => {
  const order: PosOrder = { ...base, id: 'two-cash', createdAt: new Date(2026, 9, 6, 10, 0).toISOString(),
    subtotalMinor: 500, totalMinor: 500, syncStatus: 'applied',
    payments: [{ id: 'cash1', method: 'cash', amountMinor: 300 }, { id: 'cash2', method: 'cash', amountMinor: 200 }] };
  const { today } = salesRoom([order], { now, currency: 'USD' });
  expect(today.byMethod).toEqual([{ method: 'cash', label: 'Cash', count: 1, totalMinor: 500 }]);
  expect(today.splitCount).toBe(1);
}, 20_000);

test('tax rows mirror the Z report', () => {
  const { today } = salesRoom(orders, { now, currency: 'USD' });
  expect(today.taxRates).toEqual([
    { ratePpm: 13750, label: 'Tax 1.375%', netMinor: 1600, taxMinor: 22, grossMinor: 1622 },
    { ratePpm: 72500, label: 'Tax 7.25%', netMinor: 2400, taxMinor: 174, grossMinor: 2574 },
  ]);
  expect(today.taxRates.reduce((sum, row) => sum + row.taxMinor, 0)).toBe(today.taxMinor);
}, 20_000);

test('tax rates include fee and shipping tax', () => {
  const list: PosOrder[] = [{ ...base, id: 'C1', createdAt: new Date(2026, 9, 6, 9, 15).toISOString(), syncStatus: 'applied',
    lines: [{ id: 'l1', productId: 'product1', name: 'Item 1', sku: 'sku1', quantity: 1,
      unitPriceMinor: 800, discountMinor: 0, netMinor: 800,
      taxLines: [{ ratePpm: 72500, taxMicros: '58000000' }] }],
    fees: [{ id: 'f1', name: 'Bag', amountMinor: 400, taxStatus: 'taxable', netMinor: 400, taxMicros: '29000000',
      taxLines: [{ ratePpm: 72500, taxMicros: '29000000' }] }],
    shipping: [{ id: 's1', name: 'Delivery', amountMinor: 200, taxStatus: 'taxable', netMinor: 200, taxMicros: '14500000',
      taxLines: [{ ratePpm: 72500, taxMicros: '14500000' }] }],
    subtotalMinor: 800, taxMinor: 102, totalMinor: 1502,
    payments: [{ id: 'p1', method: 'cash', amountMinor: 1502 }],
  }];
  expect(salesRoom(list, { now, currency: 'USD' }).today.taxRates).toMatchObject([
    { ratePpm: 72500, netMinor: 1400, taxMinor: 102, grossMinor: 1502 },
  ]);
});

test('yesterday excludes the day before and tomorrow', () => {
  const result = salesRoom(orders, { now, currency: 'USD' });
  expect(result.yesterday).toMatchObject({ count: 2, totalMinor: 1000 });
  expect(result.yesterday.byMethod).toEqual([
    { method: 'cash', label: 'Cash', count: 1, totalMinor: 400 },
    { method: 'external', label: 'Card terminal', count: 1, totalMinor: 600 },
  ]);
  expect(result).toEqual(salesRoom(orders.filter(order => order.id !== 'X2' && order.id !== 'X3'), { now, currency: 'USD' }));
}, 20_000);

test('the comparison uses yesterday up to the same time', () => {
  const { yesterdaySoFar, delta } = salesRoom(orders, { now, currency: 'USD' });
  expect(yesterdaySoFar).toEqual({ count: 1, totalMinor: 400, averageMinor: 400 });
  expect(delta).toEqual({ totalMinor: 2596, percentTenths: 6490, count: 3, averageMinor: 349 });
  expect(salesRoom(orders.filter(order => order.id.startsWith('T')), { now, currency: 'USD' }).delta.percentTenths).toBeNull();
}, 20_000);

test('hours span both days\' sales', () => {
  const { hours } = salesRoom(orders, { now, currency: 'USD' });
  expect(hours.map(bucket => bucket.hour)).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
  for (const bucket of hours) {
    expect(bucket.today).toEqual(bucket.hour === 9 ? { count: 2, totalMinor: 1158 }
      : bucket.hour === 13 ? { count: 2, totalMinor: 1838 } : { count: 0, totalMinor: 0 });
    expect(bucket.yesterday).toEqual(bucket.hour === 11 ? { count: 1, totalMinor: 400 }
      : bucket.hour === 16 ? { count: 1, totalMinor: 600 } : { count: 0, totalMinor: 0 });
  }
  expect(salesRoom([], { now, currency: 'USD' }).hours).toEqual([]);
}, 20_000);

test('runs in a non-UTC zone', () => {
  expect(new Date(2026, 9, 6, 9).getUTCHours()).toBe(16);
}, 20_000);
