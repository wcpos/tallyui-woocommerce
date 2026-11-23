import { expect, test } from 'vitest';
import { backordersAllowed, resolveStock, STOCK_LABEL } from '../lib/products/resolve-stock';

test('a managed product at zero with backorders allowed is on backorder', () => {
  for (const backorders of ['yes', 'notify']) {
    expect(resolveStock({ manage_stock: true, stock_quantity: 0, stock_status: 'outofstock', backorders })).toBe('onbackorder');
    expect(resolveStock({ manage_stock: true, stock_quantity: -2, backorders })).toBe('onbackorder');
    expect(backordersAllowed(backorders)).toBe(true);
  }
  for (const backorders of [undefined, 'no', 'unknown']) expect(backordersAllowed(backorders)).toBe(false);
});

test('managed stock with a quantity: above zero is in stock, zero or below is out of stock', () => {
  expect(resolveStock({ manage_stock: true, stock_quantity: 5, stock_status: 'outofstock' })).toBe('instock');
  expect(resolveStock({ manage_stock: true, stock_quantity: 0, stock_status: 'instock' })).toBe('outofstock');
  expect(resolveStock({ manage_stock: true, stock_quantity: -2, stock_status: 'onbackorder' })).toBe('outofstock');
});

test('unmanaged stock follows stock_status, and an empty or missing status is in stock', () => {
  expect(resolveStock({ manage_stock: false, stock_quantity: 5, stock_status: 'outofstock' })).toBe('outofstock');
  expect(resolveStock({ manage_stock: false, stock_quantity: 0, stock_status: 'onbackorder' })).toBe('onbackorder');
  expect(resolveStock({ manage_stock: false, stock_quantity: 0, stock_status: 'instock' })).toBe('instock');
  expect(resolveStock({ manage_stock: false, stock_status: '' })).toBe('instock');
  expect(resolveStock({})).toBe('instock');
});

test('managed stock with a null quantity falls back to stock_status', () => {
  expect(resolveStock({ manage_stock: true, stock_quantity: null, stock_status: 'outofstock' })).toBe('outofstock');
  expect(resolveStock({ manage_stock: true, stock_quantity: null, stock_status: 'onbackorder' })).toBe('onbackorder');
  expect(resolveStock({ manage_stock: true, stock_quantity: null, stock_status: 'instock' })).toBe('instock');
});

test('the labels are v2 core.json strings', () => {
  expect(STOCK_LABEL).toEqual({ instock: 'In Stock', outofstock: 'Out of Stock', onbackorder: 'On Backorder' });
});
