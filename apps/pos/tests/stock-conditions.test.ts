import { expect, test } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { LineItem } from '@tallyui/pos';
import { unmetStock, unmetText } from '../lib/stock/conditions';
import products from './fixtures/products.json';
import variations from './fixtures/variations.json';

const getId = createWooCommerceConnector().traits.product.getId;
const line: LineItem = {
  id: 'espresso', productId: '80', variantId: '80', name: 'Espresso', sku: 'COF-ESP', quantity: 1,
  unitPriceMinor: 300, taxLines: [], discounts: [], discountMinor: 0, orderDiscountMinor: 0,
  netMinor: 300, taxMicros: '0', taxInclusive: false,
};

test('a line within stock is met; a backorder-notify line past stock is met', () => {
  expect(unmetStock([line], [{ ...products[0], stock_quantity: 1 }], getId)).toEqual([]);
  expect(unmetStock([{ ...line, quantity: 2 }], [{ ...products[0], stock_quantity: 1, backorders: 'notify' }], getId)).toEqual([]);
});

test('a line past managed stock is unmet with Only n available and fits what the other lines leave', () => {
  const shirt = { ...products[2], manage_stock: true, stock_quantity: 3,
    variation_docs: variations.documents.filter(doc => doc.parent_id === products[2].id)
      .map(doc => ({ ...doc.payload, manage_stock: 'parent', stock_quantity: null })) };
  const lines = [
    { ...line, id: 'black', productId: '102', variantId: '104', name: 'T-Shirt · S / Black', quantity: 2 },
    { ...line, id: 'white', productId: '102', variantId: '105', name: 'T-Shirt · S / White', quantity: 2 },
  ];
  const unmet = unmetStock(lines, [shirt], getId);
  expect(unmet).toEqual(lines.map(line => ({ lineId: line.id, name: line.name, available: 3, fit: 1, fix: 'reduce' })));
  expect(unmetText(unmet[0])).toBe('Only 3 available for T-Shirt · S / Black');
});

test('fit is rounded so float quantities do not leak noise', () => {
  const lines = [{ ...line, id: 'a', quantity: 0.9 }, { ...line, id: 'b', quantity: 0.2 }];
  const unmet = unmetStock(lines, [{ ...products[0], stock_quantity: 1 }], getId);
  expect(unmet[1]).toEqual({ lineId: 'b', name: 'Espresso', available: 1, fit: 0.1, fix: 'reduce' });
});

test('an out-of-stock or missing record is unmet as out of stock with remove', () => {
  for (const docs of [[{ ...products[0], manage_stock: false, stock_status: 'outofstock' }], []]) {
    const unmet = unmetStock([line], docs, getId);
    expect(unmet).toEqual([{ lineId: line.id, name: line.name, available: null, fit: 0, fix: 'remove' }]);
    expect(unmetText(unmet[0])).toBe('Espresso out of stock');
  }
  for (const stock_quantity of [0, -1]) {
    const unmet = unmetStock([line], [{ ...products[0], stock_quantity }], getId);
    expect(unmet).toEqual([{ lineId: line.id, name: line.name, available: stock_quantity, fit: 0, fix: 'remove' }]);
    expect(unmetText(unmet[0])).toBe('Espresso out of stock');
  }
});

test('custom lines and store lines are not judged', () => {
  expect(unmetStock([{ ...line, custom: true }, { ...line, storeLineId: '7' },
    { ...line, quantity: 0 }, { ...line, quantity: -1 }], [], getId)).toEqual([]);
});
