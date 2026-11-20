import { expect, test } from 'vitest';
import type { Period } from '../lib/reports/sales-room';
import { salesSummary } from '../lib/reports/sales-summary';

const period: Period = {
  count: 2, totalMinor: 600, taxMinor: 0, averageMinor: 300, items: 3,
  medianMinor: 300, largestMinor: 300, discountMinor: 0, pending: 0, rejected: 0, splitCount: 0,
  byMethod: [{ method: 'cash', label: 'Cash', count: 2, totalMinor: 600 }], taxRates: [],
  byCashier: [{ cashierRef: '2', count: 2, totalMinor: 600 }],
};
const fmt = { money: (m: number) => '$' + (m / 100).toFixed(2), number: String, cashierName: (ref: string) => ref === '2' ? 'Paul' : '' };

test('group order and labels, head and final total', () => {
  const summary = salesSummary(period, fmt);
  expect(summary.groups.map(group => group.key)).toEqual(['sales', 'payments', 'orders']);
  expect(summary.groups.map(group => group.label)).toEqual(['Sales', 'Payment Methods', 'Orders']);
  expect(summary.head).toEqual(['Line', 'Count', 'Amount']);
  expect(summary.total).toEqual({ key: 'total', cells: ['Total sales', '2', '$6.00'] });
});

test('sales rows show net sales, tax, discounts and the total sales subtotal', () => {
  const summary = salesSummary({ ...period, totalMinor: 330, taxMinor: 30, discountMinor: 20 }, fmt);
  expect(summary.groups[0]).toEqual({ key: 'sales', label: 'Sales', rows: [
    { key: 'orders', cells: ['Orders', '2', ''] },
    { key: 'net', cells: ['Net sales', '', '$3.00'] },
    { key: 'tax', cells: ['Tax', '', '$0.30'] },
    { key: 'discounts', cells: ['Discounts', '', '$0.20'] },
  ], subtotal: { key: 'total', cells: ['Total sales', '', '$3.30'] } });
});

test('payments show amounts without counts and sum the amounts taken', () => {
  const summary = salesSummary({ ...period, byMethod: [
    { method: 'cash', label: 'Cash', count: 1, totalMinor: 200 },
    { method: 'external', label: 'Card terminal', count: 1, totalMinor: 130 },
  ] }, fmt);
  expect(summary.groups[1]).toEqual({ key: 'payments', label: 'Payment Methods', rows: [
    { key: 'cash', cells: ['Cash', '', '$2.00'] },
    { key: 'external', cells: ['Card terminal', '', '$1.30'] },
  ], subtotal: { key: 'total', cells: ['Taken', '', '$3.30'] } });
});

test('taxes appear only with tax, use a label fallback and sum tax collected by rate', () => {
  const taxRates = [
    { ratePpm: 100000, label: 'Tax 10%', netMinor: 300, taxMinor: 30, grossMinor: 330 },
    { ratePpm: 50000, label: '', netMinor: 200, taxMinor: 10, grossMinor: 210 },
  ];
  expect(salesSummary({ ...period, taxRates }, fmt).groups.some(group => group.key === 'taxes')).toBe(false);
  const summary = salesSummary({ ...period, taxMinor: 50, taxRates }, fmt);
  expect(summary.groups.map(group => group.key)).toEqual(['sales', 'payments', 'taxes', 'orders']);
  expect(summary.groups[2]).toEqual({ key: 'taxes', label: 'Taxes', rows: [
    { key: '100000', cells: ['Tax 10%', '', '$0.30'] },
    { key: '50000', cells: ['Tax', '', '$0.10'] },
  ], subtotal: { key: 'total', cells: ['Tax collected', '', '$0.40'] } });
});

test('cashiers appear only when more than one sold, with names, counts and summed amounts', () => {
  expect(salesSummary(period, fmt).groups.some(group => group.key === 'cashiers')).toBe(false);
  const summary = salesSummary({ ...period, taxMinor: 30, byCashier: [
    { cashierRef: '2', count: 1, totalMinor: 300 },
    { cashierRef: '', count: 2, totalMinor: 400 },
  ] }, fmt);
  expect(summary.groups.map(group => group.key)).toEqual(['sales', 'payments', 'taxes', 'cashiers', 'orders']);
  expect(summary.groups[3]).toEqual({ key: 'cashiers', label: 'Sales by cashier', rows: [
    { key: '2', cells: ['Paul', '1', '$3.00'] },
    { key: 'none', cells: ['Unknown', '2', '$4.00'] },
  ], subtotal: { key: 'total', cells: ['Total', '3', '$7.00'] } });
});

test('orders show items sold as a count and average order as an amount without a subtotal', () => {
  expect(salesSummary(period, fmt).groups[2]).toEqual({ key: 'orders', label: 'Orders', rows: [
    { key: 'items', cells: ['Items sold', '3', ''] },
    { key: 'average', cells: ['Average order', '', '$3.00'] },
  ], subtotal: null });
});
