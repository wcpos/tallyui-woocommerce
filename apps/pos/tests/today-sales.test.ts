import { expect, test } from 'vitest';
import type { PosOrder } from '@tallyui/pos';
import { dayRange, summarizeSales } from '../lib/reports/today-sales';

test('dayRange spans local midnight to the next local midnight', () => {
  expect(dayRange(new Date(2026, 9, 6, 15, 0))).toEqual({
    startIso: new Date(2026, 9, 6).toISOString(),
    endIso: new Date(2026, 9, 7).toISOString(),
  });
}, 20_000);

const base: Omit<PosOrder, 'id' | 'totalMinor' | 'payments' | 'syncStatus'> = {
  createdAt: '2026-10-06T12:00:00.000Z', updatedAt: '2026-10-06T12:00:00.000Z',
  currency: 'USD', pricesIncludeTax: false, lines: [], subtotalMinor: 0, discountMinor: 0,
  taxMinor: 0, customer: null, commandId: 'command', taxRounding: { granularity: 'per_line_items', mode: 'half_up' },
};
const orders: PosOrder[] = [
  { ...base, id: 'cash', subtotalMinor: 300, totalMinor: 300, syncStatus: 'applied',
    payments: [{ id: 'p1', method: 'cash', amountMinor: 300, tenderedMinor: 1000, changeMinor: 700 }] },
  { ...base, id: 'split', subtotalMinor: 650, totalMinor: 700, taxMinor: 50, syncStatus: 'pending',
    payments: [{ id: 'p2', method: 'cash', amountMinor: 200 }, { id: 'p3', method: 'external', amountMinor: 500 }] },
  { ...base, id: 'rejected', subtotalMinor: 100, totalMinor: 100, syncStatus: 'rejected',
    payments: [{ id: 'p4', method: 'cash', amountMinor: 100 }] },
];

test('summarizes every sync state and the applied amounts of split payments', () => {
  expect(summarizeSales(orders, 'USD')).toEqual({
    count: 3, totalMinor: 1100, taxMinor: 50, pending: 1, rejected: 1,
    byMethod: [
      { method: 'cash', label: 'Cash', count: 3, totalMinor: 600 },
      { method: 'external', label: 'Card terminal', count: 1, totalMinor: 500 },
    ],
  });
}, 20_000);

test('keeps cash first and excludes orders in another currency', () => {
  const split = { ...orders[1], payments: [...orders[1].payments].reverse() };
  expect(summarizeSales([split, orders[0], orders[2], { ...orders[0], currency: 'EUR' }], 'USD'))
    .toEqual(summarizeSales(orders, 'USD'));
  expect(summarizeSales(orders, 'JPY')).toEqual({
    count: 0, totalMinor: 0, taxMinor: 0, pending: 0, rejected: 0, byMethod: [],
  });
}, 20_000);
