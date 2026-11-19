import { expect, test } from 'vitest';
import { cashierNameFor, deviceCashiers } from '../lib/auth/cashier-name';
import type { Session } from '../lib/auth/session';

const site = { name: 'Shop', home: 'https://shop.example', wpApiUrl: '', wcposApiUrl: '', authUrl: '' };
const sessionOf = (id: number, displayName: string): Session =>
  ({ site, tokens: { accessToken: 't', refreshToken: 't', expiresAt: 0, user: { id, uuid: `u${id}`, displayName } } });

test('deviceCashiers lists the signed-in cashier first, then the roster, as id/name pairs', () => {
  expect(deviceCashiers(sessionOf(2, 'Paul'), [sessionOf(5, 'Ann'), sessionOf(9, 'Bo')]))
    .toEqual([{ id: '2', name: 'Paul' }, { id: '5', name: 'Ann' }, { id: '9', name: 'Bo' }]);
  expect(deviceCashiers(null, [sessionOf(5, 'Ann')])).toEqual([{ id: '5', name: 'Ann' }]);
});

test('cashierNameFor names a roster cashier and reads "Cashier #{id}" for an id on no list', () => {
  // v2 hooks/use-cashier-label.ts:57-62: staff display_name, else common.cashier_number (core.json:578).
  const cashiers = deviceCashiers(sessionOf(2, 'Paul'), [sessionOf(5, 'Ann')]);
  expect(cashierNameFor(cashiers, '2')).toBe('Paul');
  expect(cashierNameFor(cashiers, '5')).toBe('Ann');
  expect(cashierNameFor(cashiers, '7')).toBe('Cashier #7');
  expect(cashierNameFor([], '7')).toBe('Cashier #7');
  expect(cashierNameFor([{ id: '8', name: '' }], '8')).toBe('Cashier #8');
});
