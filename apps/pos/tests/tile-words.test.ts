import { expect, test, vi } from 'vitest';
import { inCartCounts, isSoldOut, optionsLabel, tileStockMark, tileTaxLine, tileTint, tintOf } from '../lib/catalogue/tile-words';

test('inCartCounts sums quantities per product, variations under their parent, and skips custom lines', () => {
  const counts = inCartCounts([
    { productId: '80', quantity: 2 }, { productId: '102', quantity: 1 },
    { productId: '102', quantity: 2 }, { productId: 'custom:x', quantity: 4, custom: true },
  ]);
  expect(counts).toEqual(new Map([['80', 2], ['102', 3]]));
  expect(counts.has('custom:x')).toBe(false);
  expect(inCartCounts([]).size).toBe(0);
});

test('tileStockMark counts managed stock that is left', () => {
  expect(tileStockMark({ status: 'in_stock', quantity: 100 }, false)).toEqual({ kind: 'count', value: 100, label: '100 left' });
});

test('tileStockMark says Backorder for a backorder at none or below', () => {
  expect(tileStockMark({ status: 'backorder', quantity: 0 }, false)).toEqual({ kind: 'backorder', label: 'Backorder' });
  expect(tileStockMark({ status: 'backorder', quantity: -2 }, false)).toEqual({ kind: 'backorder', label: 'Backorder' });
});

test('tileStockMark shows nothing for unmanaged, out-of-stock or variable stock', () => {
  expect(tileStockMark({ status: 'in_stock' }, false)).toBeNull();
  expect(tileStockMark({ status: 'out_of_stock', quantity: 0 }, false)).toBeNull();
  expect(tileStockMark({ status: 'in_stock', quantity: 5 }, true)).toBeNull();
});

test('isSoldOut is true only for a product that is out, never a variable one', () => {
  expect(isSoldOut({ status: 'out_of_stock' }, false)).toBe(true);
  expect(isSoldOut({ status: 'out_of_stock' }, true)).toBe(false);
  expect(isSoldOut({ status: 'in_stock' }, false)).toBe(false);
});

test('tileTaxLine shows exclusive and inclusive tax from the class rate', () => {
  const price = { amount: 300, currency: 'USD' };
  const getTaxRatePpm = vi.fn(() => 100000);
  expect(tileTaxLine(price, 'taxable', 'reduced-rate', { pricesIncludeTax: false, getTaxRatePpm })).toBe('excl. $0.30 tax');
  expect(tileTaxLine(price, 'taxable', 'reduced-rate', { pricesIncludeTax: true, getTaxRatePpm })).toBe('incl. $0.27 tax');
  expect(getTaxRatePpm).toHaveBeenCalledWith('reduced-rate');
});

test('tileTaxLine shows nothing for a product that is not taxable or a zero rate', () => {
  const price = { amount: 300, currency: 'USD' };
  const tax = { pricesIncludeTax: false, getTaxRatePpm: () => 100000 };
  expect(tileTaxLine(price, 'none', undefined, tax)).toBeNull();
  expect(tileTaxLine(price, undefined, undefined, tax)).toBeNull();
  expect(tileTaxLine(price, 'taxable', undefined, { ...tax, getTaxRatePpm: () => 0 })).toBeNull();
});

test('tintOf takes a number modulo six, truncated, never negative', () => {
  expect(tintOf(25)).toBe(1);
  expect(tintOf(27)).toBe(3);
  expect(tintOf(6.9)).toBe(0);
  expect(tintOf(-1)).toBe(5);
  expect(tintOf(Number.NaN)).toBe(0);
});

test('tintOf sums a string\'s UTF-16 code units modulo six', () => {
  expect(tintOf('Espresso')).toBe(0);
  expect(tintOf('Coffee')).toBe(2);
  expect(tintOf('')).toBe(0);
});

test('tileTint keys by the first numeric category id, else that id as text, else the name', () => {
  expect(tileTint([{ id: '31' }, { id: '27' }], 'Espresso')).toBe(1);
  expect(tileTint([{ id: 'Coffee' }], 'Espresso')).toBe(2);
  expect(tileTint([], 'Espresso')).toBe(0);
});

test('optionsLabel says option or options, and nothing under one', () => {
  expect(optionsLabel(1)).toBe('1 option');
  expect(optionsLabel(6)).toBe('6 options');
  expect(optionsLabel(0)).toBeNull();
});
