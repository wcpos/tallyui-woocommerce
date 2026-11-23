import { expect, test } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { catalogueEntries } from '@tallyui/pos';
import { backorderToast, entryStockDocs, evaluateStock, existingCartQuantity, lineStockDocs, stockGuardToast } from '../lib/stock/stock-guard';
import products from './fixtures/products.json';
import variations from './fixtures/variations.json';

const product = { manage_stock: true, stock_quantity: 1 };
const lines = [
  { productId: '102', variantId: '104', quantity: 2 },
  { productId: '102', variantId: '105', quantity: 3 },
  { productId: '999', variantId: '104', quantity: 4 },
];

test('a managed product within stock is allowed', () => {
  expect(evaluateStock({ product }, 0, 1)).toEqual({ allowed: true, warning: null, available: 1 });
  expect(evaluateStock({ product: { ...product, stock_quantity: 0.3 } }, 0.1, 0.2).allowed).toBe(true);
});

test('a managed product past its stock is refused with what is available', () => {
  expect(evaluateStock({ product }, 1, 1)).toEqual({ allowed: false, warning: null, available: 1 });
  for (const backorders of [undefined, 'no', 'unknown']) {
    expect(evaluateStock({ product: { ...product, stock_quantity: 0, backorders } }, 0, 1).allowed).toBe(false);
  }
});

test('backorders notify allows with a warning and yes allows silently', () => {
  expect(evaluateStock({ product: { ...product, backorders: 'notify' } }, 1, 1))
    .toEqual({ allowed: true, warning: 'backorder', available: 1 });
  expect(evaluateStock({ product: { ...product, backorders: 'yes' } }, 1, 1))
    .toEqual({ allowed: true, warning: null, available: 1 });
  expect(evaluateStock({ product: { ...product, backorders: 'notify' } }, 0, 1).warning).toBeNull();
});

test('an unmanaged out-of-stock product is refused with no quantity', () => {
  expect(evaluateStock({ product: { manage_stock: false, stock_status: 'outofstock', backorders: 'yes' } }, 0, 1))
    .toEqual({ allowed: false, warning: null, available: null });
  expect(evaluateStock({ product: {}, variation: { stock_status: 'outofstock' } }, 0, 1).allowed).toBe(false);
  for (const stock_quantity of [null, undefined, NaN, Infinity]) {
    expect(evaluateStock({ product: { ...product, stock_quantity, stock_status: 'outofstock' }, variation: { stock_status: 'instock' } }, 0, 1))
      .toEqual({ allowed: false, warning: null, available: null });
  }
});

test('a variation that owns its stock counts only its own lines', () => {
  const shirt = { ...products[2], manage_stock: true, stock_quantity: 20,
    variation_docs: variations.documents.filter(doc => doc.parent_id === products[2].id)
      .map(doc => ({ ...doc.payload, manage_stock: true, stock_quantity: 2 })) };
  const entry = catalogueEntries([shirt], createWooCommerceConnector().traits.product, { currency: 'USD' })
    .find(item => item.variant.id === '104')!;
  const docs = entryStockDocs(entry);
  expect(docs.variation).toBe(shirt.variation_docs.find(doc => doc.id === 104));
  expect(existingCartQuantity(lines, '102', '104', docs)).toBe(2);
  expect(evaluateStock(docs, 2, 1)).toEqual({ allowed: false, warning: null, available: 2 });
  expect(entryStockDocs({ ...entry, product: { ...shirt, type: 'simple' } }).variation).toBeUndefined();
});

test('lineStockDocs finds the product, and the variation of a variable product', () => {
  const shirt = { ...products[2], variation_docs: variations.documents.filter(doc => doc.parent_id === products[2].id).map(doc => doc.payload) };
  const getId = createWooCommerceConnector().traits.product.getId;
  const docs = [products[0], shirt];
  expect(lineStockDocs(docs, getId, { productId: getId(products[0]) })).toEqual({ product: products[0], variation: undefined });
  const found = lineStockDocs(docs, getId, { productId: getId(shirt), variantId: '104' });
  expect(found?.product).toBe(shirt);
  expect(found?.variation).toBe(shirt.variation_docs.find(doc => doc.id === 104));
  expect(lineStockDocs(docs, getId, { productId: getId(shirt), variantId: 'missing' })?.variation).toBeUndefined();
  expect(lineStockDocs(docs, getId, { productId: 'missing' })).toBeUndefined();
  expect(lineStockDocs([{ ...shirt, type: 'simple' }], getId, { productId: getId(shirt), variantId: '104' })?.variation).toBeUndefined();
});

test('parent-managed stock counts every line of the product', () => {
  const docs = { product, variation: { manage_stock: 'parent' as const, stock_quantity: 99 } };
  expect(existingCartQuantity(lines, '102', '104', docs)).toBe(5);
  expect(evaluateStock(docs, 5, 1)).toEqual({ allowed: false, warning: null, available: 1 });
  expect(existingCartQuantity(lines, '102', '104', { product: {} })).toBe(2);
});

test('custom lines and lines kept from the store count nothing', () => {
  const kept = [lines[0], { ...lines[0], custom: true as const }, { ...lines[0], storeLineId: '7' }];
  expect(existingCartQuantity(kept, '102', '104', { product })).toBe(2);
});

test("refusal toasts use v2's wording", () => {
  expect(stockGuardToast(evaluateStock({ product }, 1, 1), 'Espresso')).toBe('Only 1 available for Espresso');
  expect(stockGuardToast(evaluateStock({ product: { stock_status: 'outofstock' } }, 0, 1), 'T-Shirt · S'))
    .toBe('T-Shirt · S out of stock');
  expect(stockGuardToast(evaluateStock({ product }, 0, 1), 'Espresso')).toBeNull();
  expect(backorderToast('Espresso')).toBe('Espresso will be backordered');
});
