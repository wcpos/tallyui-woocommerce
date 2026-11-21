// H4b part 2 (f): the lib money helpers take the store's money format as an optional last argument (v2
// hooks/use-currency-format.tsx:21-60) and, without it, read exactly as before.
import { expect, test } from 'vitest';
import { minorToMajor, minorUnitDigits, type MoneyFormat, type StoreOrder } from '@tallyui/core';
import { formatTileMoney, tileTaxLine } from '../lib/catalogue/tile-words';
import { sheetMoney } from '../lib/cashier/sheet-figures';
import { orderRowCells } from '../lib/orders/order-days';
import { wholeMoney } from '../lib/reports/whole-money';

const EURO: MoneyFormat = { position: 'right_space', thousandSeparator: '.', decimalSeparator: ',', decimals: 2, symbol: '€' };

test('formatTileMoney: the store format when given, today\'s Intl string without it', () => {
  expect(formatTileMoney({ amount: 123456, currency: 'USD' }, EURO)).toBe('1.234,56 €');
  expect(formatTileMoney({ amount: 123456, currency: 'USD' })).toBe('$1,234.56');
});

test('formatTileMoney falls back to the plain major amount, with no hard-coded $, for a currency it cannot format', () => {
  const fallback = formatTileMoney({ amount: 375, currency: 'XXX' }, EURO);
  expect(fallback).toBe(minorToMajor(375, minorUnitDigits('XXX')));
  expect(fallback).not.toContain('$');
});

test('tileTaxLine words the tax amount in the store format', () => {
  const tax = { pricesIncludeTax: false, getTaxRatePpm: () => 100000 };
  expect(tileTaxLine({ amount: 300, currency: 'USD' }, 'taxable', undefined, tax, EURO)).toBe('excl. 0,30 € tax');
  expect(tileTaxLine({ amount: 300, currency: 'USD' }, 'taxable', undefined, tax)).toBe('excl. $0.30 tax');
});

test('sheetMoney: the store format when given, today\'s string without it', () => {
  expect(sheetMoney(123456, 'USD', 'en_US', EURO)).toBe('1.234,56 €');
  expect(sheetMoney(123456, 'USD', 'en_US')).toBe('$1,234.56');
  expect(sheetMoney(375, 'USD')).toBe('$3.75');
});

const storeOrder: StoreOrder = {
  id: '901', reference: '901', status: 'completed', placedAt: new Date(2026, 10, 10, 10, 0).toISOString(),
  currency: 'USD', pricesIncludeTax: false, customer: null,
  lines: [], fees: [], shipping: [], coupons: [], taxLines: [], refunds: [{ id: 'r1', amountMinor: -150 }],
  payments: [{ method: 'pos_cash', title: 'Cash', kind: 'cash', amountMinor: 123456 }],
  discountMinor: 0, discountTaxMinor: 0, taxMinor: 0, totalMinor: 123456,
};

test('orderRowCells: total and refunds in the store format when given, today\'s strings without it', () => {
  const now = new Date(2026, 10, 10, 15, 0);
  const withFormat = orderRowCells({ kind: 'store', order: storeOrder }, now, EURO);
  expect([withFormat.total, withFormat.refunds]).toEqual(['1.234,56 €', '-1,50 €']);
  const without = orderRowCells({ kind: 'store', order: storeOrder }, now);
  expect([without.total, without.refunds]).toEqual(['$1,234.56', '-$1.50']);
});

test('wholeMoney rounds to whole units with no decimals, in the store format when given', () => {
  expect(wholeMoney(123456, 'USD', 'en-US', EURO)).toBe('1.235 €');
  expect(wholeMoney(123456, 'USD', 'en-US')).toBe('$1,235');
  expect(wholeMoney(0, 'USD', 'en-US')).toBe('$0');
});
