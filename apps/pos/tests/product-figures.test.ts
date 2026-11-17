import { expect, test } from 'vitest';
import type { PosOrder } from '@tallyui/pos';
import { productFigures } from '../lib/reports/product-figures';

const range = { from: '2026-10-06', to: '2026-10-06' };
const base: Omit<PosOrder, 'id' | 'totalMinor' | 'payments' | 'syncStatus'> = {
  createdAt: new Date(2026, 9, 6, 9, 15).toISOString(), updatedAt: new Date(2026, 9, 6, 14, 30).toISOString(),
  currency: 'USD', pricesIncludeTax: false, lines: [], subtotalMinor: 0, discountMinor: 0,
  taxMinor: 0, customer: null, commandId: 'command', taxRounding: { granularity: 'per_line_items', mode: 'half_up' },
};

test('productFigures rolls the period\'s lines up by product, largest amount first, with units sold', () => {
  const orders: PosOrder[] = [
    { ...base, id: 'A', totalMinor: 1000, payments: [], syncStatus: 'applied', lines: [
      { id: 'a1', productId: 'p1', name: 'Espresso', sku: '', quantity: 2, unitPriceMinor: 300, discountMinor: 0, netMinor: 600, taxLines: [] },
      { id: 'a2', productId: 'p2', name: 'Muffin', sku: '', quantity: 1, unitPriceMinor: 400, discountMinor: 0, netMinor: 400, taxLines: [] },
    ] },
    { ...base, id: 'B', totalMinor: 300, payments: [], syncStatus: 'applied', lines: [
      { id: 'b1', productId: 'p1', name: 'Espresso', sku: '', quantity: 1, unitPriceMinor: 300, discountMinor: 0, netMinor: 300, taxLines: [] },
    ] },
    { ...base, id: 'C', totalMinor: 2000, payments: [], syncStatus: 'applied', lines: [
      { id: 'c1', productId: 'p3', variantId: 'v9', name: 'Tee — Large', sku: '', quantity: 1, unitPriceMinor: 2000, discountMinor: 0, netMinor: 2000, taxLines: [] },
    ] },
    { ...base, id: 'D', currency: 'EUR', totalMinor: 5000, payments: [], syncStatus: 'applied', lines: [
      { id: 'd1', productId: 'p1', name: 'Espresso', sku: '', quantity: 1, unitPriceMinor: 5000, discountMinor: 0, netMinor: 5000, taxLines: [] },
    ] },
    { ...base, id: 'E', createdAt: new Date(2026, 9, 5, 9, 15).toISOString(), totalMinor: 5000, payments: [], syncStatus: 'applied', lines: [
      { id: 'e1', productId: 'p1', name: 'Espresso', sku: '', quantity: 1, unitPriceMinor: 5000, discountMinor: 0, netMinor: 5000, taxLines: [] },
    ] },
  ];
  expect(productFigures(orders, { currency: 'USD', range })).toEqual([
    { key: 'v9', productId: 'p3', name: 'Tee — Large', quantity: 1, amountMinor: 2000 },
    { key: 'p1', productId: 'p1', name: 'Espresso', quantity: 3, amountMinor: 900 },
    { key: 'p2', productId: 'p2', name: 'Muffin', quantity: 1, amountMinor: 400 },
  ]);
});

test('an exclusive line adds its tax; an inclusive line\'s net already holds it', () => {
  const orders: PosOrder[] = [
    { ...base, id: 'exclusive', totalMinor: 858, payments: [], syncStatus: 'applied', lines: [
      { id: 'l1', productId: 'p1', name: 'Exclusive', sku: '', quantity: 1, unitPriceMinor: 800, discountMinor: 0, netMinor: 800,
        taxLines: [{ ratePpm: 72500, taxMicros: '58000000' }] },
    ] },
    { ...base, id: 'inclusive', pricesIncludeTax: true, totalMinor: 1933, payments: [], syncStatus: 'applied', lines: [
      { id: 'l2', productId: 'p2', name: 'Inclusive', sku: '', quantity: 1, unitPriceMinor: 1075, discountMinor: 0, netMinor: 1075,
        taxLines: [{ ratePpm: 75000, taxMicros: '75000000' }] },
      { id: 'l3', productId: 'p3', name: 'Override', sku: '', quantity: 1, unitPriceMinor: 800, discountMinor: 0, netMinor: 800,
        taxInclusive: false, taxLines: [{ ratePpm: 72500, taxMicros: '58000000' }] },
    ] },
  ];
  expect(productFigures(orders, { currency: 'USD', range })).toEqual([
    { key: 'p2', productId: 'p2', name: 'Inclusive', quantity: 1, amountMinor: 1075 },
    { key: 'p1', productId: 'p1', name: 'Exclusive', quantity: 1, amountMinor: 858 },
    { key: 'p3', productId: 'p3', name: 'Override', quantity: 1, amountMinor: 858 },
  ]);
});

test('equal amounts sort by name', () => {
  const orders: PosOrder[] = [{ ...base, id: 'ties', totalMinor: 200, payments: [], syncStatus: 'applied', lines: [
    { id: 'l1', productId: 'p1', name: 'Banana', sku: '', quantity: 1, unitPriceMinor: 100, discountMinor: 0, netMinor: 100, taxLines: [] },
    { id: 'l2', productId: 'p2', name: 'Apple', sku: '', quantity: 1, unitPriceMinor: 100, discountMinor: 0, netMinor: 100, taxLines: [] },
  ] }];
  expect(productFigures(orders, { currency: 'USD', range }).map(row => row.name)).toEqual(['Apple', 'Banana']);
});
