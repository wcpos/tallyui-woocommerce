// H4b (f, h, j): the lib money helpers take the store's money (its currency and format) as an optional last argument
// (v2 hooks/use-currency-format.tsx:21-60). The store's format applies only to money in the store's currency; any
// other currency, or no store, reads as Intl does, exactly as before.
import { expect, test } from 'vitest';
import { minorToMajor, minorUnitDigits, type MoneyFormat, type StoreOrder } from '@tallyui/core';
import { formatTileMoney, tileTaxLine } from '../lib/catalogue/tile-words';
import { sheetMoney } from '../lib/cashier/sheet-figures';
import { orderRowCells } from '../lib/orders/order-days';
import { wholeMoney } from '../lib/reports/whole-money';
import { formatStoreMoney, type StoreMoney } from '../lib/money/store-money';

const EURO: MoneyFormat = { position: 'right_space', thousandSeparator: '.', decimalSeparator: ',', decimals: 2, symbol: '€' };
const EUR_STORE: StoreMoney = { currency: 'EUR', format: EURO };

test('formatTileMoney: the store format for the store\'s currency, today\'s Intl string without a store', () => {
  expect(formatTileMoney({ amount: 123456, currency: 'EUR' }, EUR_STORE)).toBe('1.234,56 €');
  expect(formatTileMoney({ amount: 123456, currency: 'USD' })).toBe('$1,234.56');
});

test('formatTileMoney falls back to the plain major amount, with no hard-coded $, for a currency it cannot format', () => {
  const fallback = formatTileMoney({ amount: 375, currency: 'XXX' }, { ...EUR_STORE, currency: 'XXX' });
  expect(fallback).toBe(minorToMajor(375, minorUnitDigits('XXX')));
  expect(fallback).not.toContain('$');
});

test('tileTaxLine words the tax amount in the store format', () => {
  const tax = { pricesIncludeTax: false, getTaxRatePpm: () => 100000 };
  expect(tileTaxLine({ amount: 300, currency: 'EUR' }, 'taxable', undefined, tax, EUR_STORE)).toBe('excl. 0,30 € tax');
  expect(tileTaxLine({ amount: 300, currency: 'USD' }, 'taxable', undefined, tax)).toBe('excl. $0.30 tax');
});

test('sheetMoney: the store format for the store\'s currency, today\'s string without a store', () => {
  expect(sheetMoney(123456, 'EUR', 'en_US', EUR_STORE)).toBe('1.234,56 €');
  expect(sheetMoney(123456, 'USD', 'en_US')).toBe('$1,234.56');
  expect(sheetMoney(375, 'USD')).toBe('$3.75');
});

const storeOrder: StoreOrder = {
  id: '901', reference: '901', status: 'completed', placedAt: new Date(2026, 10, 10, 10, 0).toISOString(),
  currency: 'EUR', pricesIncludeTax: false, customer: null,
  lines: [], fees: [], shipping: [], coupons: [], taxLines: [], refunds: [{ id: 'r1', amountMinor: -150 }],
  payments: [{ method: 'pos_cash', title: 'Cash', kind: 'cash', amountMinor: 123456 }],
  discountMinor: 0, discountTaxMinor: 0, taxMinor: 0, totalMinor: 123456,
};

test('orderRowCells: total and refunds in the store format for an order in the store\'s currency, Intl without a store', () => {
  const now = new Date(2026, 10, 10, 15, 0);
  const withStore = orderRowCells({ kind: 'store', order: storeOrder }, now, EUR_STORE);
  expect([withStore.total, withStore.refunds]).toEqual(['1.234,56 €', '-1,50 €']);
  const usd = { ...storeOrder, currency: 'USD' };
  const without = orderRowCells({ kind: 'store', order: usd }, now);
  expect([without.total, without.refunds]).toEqual(['$1,234.56', '-$1.50']);
});

test('(h) an order in another currency reads Intl\'s string for its own currency, never the store\'s symbol', () => {
  const now = new Date(2026, 10, 10, 15, 0);
  const usd: StoreOrder = { ...storeOrder, currency: 'USD', totalMinor: 1250, refunds: [] };
  const cells = orderRowCells({ kind: 'store', order: usd }, now, EUR_STORE);
  expect(cells.total).toBe('$12.50');
  expect(cells.total).not.toContain('€');
  // The store's own currency, in any case, still reads in its format.
  expect(formatStoreMoney({ amount: 1250, currency: 'EUR' }, EUR_STORE)).toBe('12,50 €');
  expect(formatStoreMoney({ amount: 1250, currency: 'eur' }, EUR_STORE)).toBe('12,50 €');
  expect(formatStoreMoney({ amount: 1250, currency: 'USD' }, EUR_STORE)).toBe('$12.50');
});

test('(j) wholeMoney rounds to whole units with no decimals, in the store format for the store\'s currency', () => {
  expect(wholeMoney(123456, 'EUR', 'en-US', EUR_STORE)).toBe('1.235 €');
  expect(wholeMoney(123456, 'USD', 'en-US', EUR_STORE)).toBe('$1,235');
  expect(wholeMoney(123456, 'USD', 'en-US')).toBe('$1,235');
  expect(wholeMoney(0, 'USD', 'en-US')).toBe('$0');
  // A negative half rounds away from zero on the formatted path.
  expect(wholeMoney(-1250, 'USD', 'en-US')).toBe('-$13');
});

test('(j) wholeMoney falls back to the whole major amount, not the minor units, for a currency it cannot format', () => {
  const digits = minorUnitDigits('XXX');
  expect(wholeMoney(123456, 'XXX', 'en-US')).toBe(String(Math.round(123456 / 10 ** digits)));
  expect(wholeMoney(123456, 'XXX', 'en-US')).not.toBe('123456');
  // A negative half rounds away from zero, as the formatted path does (-12.50 reads -13, not Math.round's -12).
  expect(wholeMoney(-1250, 'XXX', 'en-US')).toBe(String(-Math.round(1250 / 10 ** digits)));
  expect(digits).toBe(2);
});
