import { formatMoney } from '@tallyui/core';
import { expect, test, vi } from 'vitest';
import { SessionExpiredError } from '../lib/auth/session';
import type { Session } from '../lib/auth/session';
import { fetchStoreInfo, StoreAccessDeniedError, toBcp47Locale } from '../lib/catalogue/store-info';
import stores from './fixtures/stores.json';

const home = 'https://shop.example';
const session: Session = {
  site: { name: 'Store', home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
  tokens: { accessToken: 't1', refreshToken: 'refresh', expiresAt: 2000000000, user: { id: 2, uuid: 'cashier', displayName: 'Cashier' } },
};
const headers = { Authorization: 'Bearer t1' };

test('maps the first fixture store and sends the supplied headers', async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json(stores));
  expect(await fetchStoreInfo(session, headers, fetchImpl as unknown as typeof fetch)).toEqual({
    id: 0, name: stores[0].name, currency: 'USD', locale: 'en-US', address: {}, calcTaxes: false,
    numberFormat: { position: 'left', thousandSeparator: ',', decimalSeparator: '.', decimals: 2 },
  });
  expect(fetchImpl).toHaveBeenCalledWith(`${session.site.wcposApiUrl}/stores`, { headers });
});

test.each([
  ['en_US', 'en-US'], ['de_DE_formal', 'de-DE-formal'], ['pt_PT_ao90', 'pt-PT'], ['en-GB', 'en-GB'],
  ['', undefined], [undefined, undefined], [42, undefined],
] as const)('toBcp47Locale(%j) is %j', (value, expected) => {
  expect(toBcp47Locale(value)).toBe(expected);
});

test('a WordPress en_US store locale reaches formatMoney as en-US and formats money', async () => {
  const info = await respond({ locale: 'en_US' });
  expect(info.locale).toBe('en-US');
  expect(formatMoney({ amount: 600, currency: 'USD' }, info.locale)).toBe('$6.00');
});

const respond = (fields: Record<string, unknown>) => fetchStoreInfo(session, headers,
  vi.fn<typeof fetch>().mockResolvedValue(Response.json([{ ...stores[0], ...fields }])) as unknown as typeof fetch);

test('maps the base address, the tax basis and Enable Taxes', async () => {
  const info = await respond({
    store_address: '1 Main St', store_address_2: 'Suite 2', store_city: 'Birmingham', store_state: 'AL',
    store_postcode: '12345', store_country: 'US', tax_based_on: 'billing', calc_taxes: 'yes',
  });
  expect(info.address).toEqual({
    address1: '1 Main St', address2: 'Suite 2', city: 'Birmingham', state: 'AL', postcode: '12345', country: 'US',
  });
  expect(info.taxBasedOn).toBe('billing');
  expect(info.calcTaxes).toBe(true);
});

test('empty address fields, an unknown tax basis and an odd calc_taxes read as absent', async () => {
  const info = await respond({
    store_address: '', store_address_2: '', store_city: '', store_state: '', store_postcode: '', store_country: '',
    tax_based_on: 'store', calc_taxes: 'maybe',
  });
  expect(Object.values(info.address ?? {}).every(value => value === undefined)).toBe(true);
  expect(info.address?.city).toBeUndefined();
  expect(info.taxBasedOn).toBeUndefined();
  expect(info.calcTaxes).toBeUndefined();
});

test.each([['yes', true], ['no', false]] as const)('calc_taxes %j reads %s', async (calc, expected) => {
  expect((await respond({ calc_taxes: calc })).calcTaxes).toBe(expected);
});

test.each(['base', 'billing', 'shipping'] as const)('tax_based_on %j is kept', async basis => {
  expect((await respond({ tax_based_on: basis })).taxBasedOn).toBe(basis);
});

test('maps the default customer and "is cashier" from the stores response', async () => {
  const info = await respond({ default_customer: 7, default_customer_is_cashier: true });
  expect(info.defaultCustomerId).toBe(7);
  expect(info.defaultCustomerIsCashier).toBe(true);
  expect((await respond({ default_customer: 0, default_customer_is_cashier: false })))
    .toMatchObject({ defaultCustomerId: 0, defaultCustomerIsCashier: false });
});

test.each([[true, true], [false, false], ['yes', true], ['no', false], ['maybe', undefined], [1, undefined], [undefined, undefined]] as const)(
  'default_customer_is_cashier %j reads %j', async (value, expected) => {
    expect((await respond({ default_customer_is_cashier: value })).defaultCustomerIsCashier).toBe(expected);
  });

test.each([[12, 12], ['12', 12], [0, 0], [-1, undefined], [2.5, undefined], ['', undefined], ['abc', undefined], [null, undefined]] as const)(
  'default_customer %j reads %j', async (value, expected) => {
    expect((await respond({ default_customer: value })).defaultCustomerId).toBe(expected);
  });

test('a store without the default-customer fields leaves them undefined', async () => {
  const info = await respond({});
  expect(info.defaultCustomerId).toBeUndefined();
  expect(info.defaultCustomerIsCashier).toBeUndefined();
});

test('maps the number format, keeping an empty thousand separator as no grouping', async () => {
  const info = await respond({ currency_pos: 'right_space', price_thousand_sep: '', price_decimal_sep: ',', price_num_decimals: '3' });
  expect(info.numberFormat).toEqual({ position: 'right_space', thousandSeparator: '', decimalSeparator: ',', decimals: 3 });
  expect(info.numberFormat!.thousandSeparator).toBe('');
});

test.each(['left', 'right', 'left_space', 'right_space'] as const)('currency_pos %j is kept', async position => {
  expect((await respond({ currency_pos: position })).numberFormat?.position).toBe(position);
});

test('drops an invalid number format value', async () => {
  const info = await respond({ currency_pos: 'middle', price_thousand_sep: 3, price_decimal_sep: '', price_num_decimals: '-1' });
  expect(info.numberFormat).toEqual({ position: undefined, thousandSeparator: undefined, decimalSeparator: undefined, decimals: undefined });
  expect((await respond({ price_num_decimals: 'two' })).numberFormat?.decimals).toBeUndefined();
  expect((await respond({ price_num_decimals: 0 })).numberFormat?.decimals).toBe(0);
});

test('uppercases the currency', async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json([{ ...stores[0], currency: 'usd' }]));
  expect((await fetchStoreInfo(session, headers, fetchImpl as unknown as typeof fetch)).currency).toBe('USD');
});

test('rejects a 401 as an expired session', async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 }));
  await expect(fetchStoreInfo(session, headers, fetchImpl as unknown as typeof fetch)).rejects.toBeInstanceOf(SessionExpiredError);
});

test('rejects a 403 as a user without POS access, not an expired session', async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403 }));
  const failure = fetchStoreInfo(session, headers, fetchImpl as unknown as typeof fetch);
  await expect(failure).rejects.toBeInstanceOf(StoreAccessDeniedError);
  await expect(failure).rejects.not.toBeInstanceOf(SessionExpiredError);
});

test('rejects a 500 as a plain failure, not an expired session', async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 500 }));
  const failure = fetchStoreInfo(session, headers, fetchImpl as unknown as typeof fetch);
  await expect(failure).rejects.toThrow('stores request failed: 500');
  await expect(failure).rejects.not.toBeInstanceOf(SessionExpiredError);
});

test('rejects an empty array', async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json([]));
  await expect(fetchStoreInfo(session, headers, fetchImpl as unknown as typeof fetch)).rejects.toThrow('stores response is empty');
});
