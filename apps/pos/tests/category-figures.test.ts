import { expect, test } from 'vitest';
import type { PosOrder } from '@tallyui/pos';
import { categoryFigures } from '../lib/reports/category-figures';

const range = { from: '2026-10-06', to: '2026-10-06' };
const base: Omit<PosOrder, 'id' | 'totalMinor' | 'payments' | 'syncStatus'> = {
  createdAt: new Date(2026, 9, 6, 9, 15).toISOString(), updatedAt: new Date(2026, 9, 6, 14, 30).toISOString(),
  currency: 'USD', pricesIncludeTax: false, lines: [], subtotalMinor: 0, discountMinor: 0,
  taxMinor: 0, customer: null, commandId: 'command', taxRounding: { granularity: 'per_line_items', mode: 'half_up' },
};
const products = [
  { id: 1, categories: [{ id: 10, name: 'Coffee' }] },
  { id: 2, categories: [{ id: 10, name: 'Coffee' }] },
  { id: 3, categories: [{ id: 20, name: 'Bakery' }, { id: 30, name: 'Sweets' }] },
];

test('categoryFigures sums lines by their product\'s first category, largest amount first', () => {
  const orders: PosOrder[] = [{ ...base, id: 'A', totalMinor: 1300, payments: [], syncStatus: 'applied', lines: [
    { id: 'a1', productId: '3', name: 'Muffin', sku: '', quantity: 1, unitPriceMinor: 400, discountMinor: 0, netMinor: 400, taxLines: [] },
    { id: 'a2', productId: '1', name: 'Espresso', sku: '', quantity: 2, unitPriceMinor: 300, discountMinor: 0, netMinor: 600, taxLines: [] },
    { id: 'a3', productId: '2', name: 'Latte', sku: '', quantity: 1, unitPriceMinor: 300, discountMinor: 0, netMinor: 300, taxLines: [] },
  ] }];
  expect(categoryFigures(orders, products, { currency: 'USD', range })).toEqual({
    parts: [
      { key: '10', label: 'Coffee', amountMinor: 900, quantity: 3 },
      { key: '20', label: 'Bakery', amountMinor: 400, quantity: 1 },
    ], unknownLines: 0, totalLines: 3,
  });
});

test('a product with no categories goes under Uncategorised', () => {
  const orders: PosOrder[] = [{ ...base, id: 'A', totalMinor: 600, payments: [], syncStatus: 'applied', lines: [
    { id: 'a1', productId: '1', name: 'Espresso', sku: '', quantity: 2, unitPriceMinor: 300, discountMinor: 0, netMinor: 600, taxLines: [] },
  ] }];
  expect(categoryFigures(orders, [{ id: 1, categories: [] }], { currency: 'USD', range })).toEqual({
    parts: [{ key: 'uncategorised', label: 'Uncategorised', amountMinor: 600, quantity: 2 }], unknownLines: 0, totalLines: 1,
  });
});

test('a line whose product is not synced goes under Unknown product and counts as an unknown line', () => {
  const orders: PosOrder[] = [{ ...base, id: 'A', totalMinor: 900, payments: [], syncStatus: 'applied', lines: [
    { id: 'a1', productId: '99', name: 'Missing', sku: '', quantity: 2, unitPriceMinor: 300, discountMinor: 0, netMinor: 600, taxLines: [] },
    { id: 'a2', productId: '1', name: 'Espresso', sku: '', quantity: 1, unitPriceMinor: 300, discountMinor: 0, netMinor: 300, taxLines: [] },
  ] }];
  expect(categoryFigures(orders, products, { currency: 'USD', range })).toEqual({
    parts: [
      { key: 'unknown', label: 'Unknown product', amountMinor: 600, quantity: 2 },
      { key: '10', label: 'Coffee', amountMinor: 300, quantity: 1 },
    ], unknownLines: 1, totalLines: 2,
  });
});

test('orders out of the period or in another currency are left out', () => {
  const order: PosOrder = { ...base, id: 'A', totalMinor: 300, payments: [], syncStatus: 'applied', lines: [
    { id: 'a1', productId: '1', name: 'Espresso', sku: '', quantity: 1, unitPriceMinor: 300, discountMinor: 0, netMinor: 300, taxLines: [] },
  ] };
  expect(categoryFigures([
    { ...order, createdAt: new Date(2026, 9, 5, 9, 15).toISOString() },
    { ...order, id: 'B', currency: 'EUR' },
  ], products, { currency: 'USD', range })).toEqual({ parts: [], unknownLines: 0, totalLines: 0 });
});

test('a tax-exclusive line adds its tax; an inclusive line\'s net already holds it', () => {
  const orders: PosOrder[] = [
    { ...base, id: 'exclusive', totalMinor: 859, payments: [], syncStatus: 'applied', lines: [
      { id: 'l1', productId: '1', name: 'Exclusive', sku: '', quantity: 1, unitPriceMinor: 800, discountMinor: 0, netMinor: 800,
        taxLines: [{ ratePpm: 73125, taxMicros: '58500000' }] },
    ] },
    { ...base, id: 'inclusive', pricesIncludeTax: true, totalMinor: 1075, payments: [], syncStatus: 'applied', lines: [
      { id: 'l2', productId: '3', name: 'Inclusive', sku: '', quantity: 1, unitPriceMinor: 1075, discountMinor: 0, netMinor: 1075,
        taxLines: [{ ratePpm: 75000, taxMicros: '75000000' }] },
    ] },
  ];
  expect(categoryFigures(orders, products, { currency: 'USD', range })).toEqual({
    parts: [
      { key: '20', label: 'Bakery', amountMinor: 1075, quantity: 1 },
      { key: '10', label: 'Coffee', amountMinor: 859, quantity: 1 },
    ], unknownLines: 0, totalLines: 2,
  });
});
