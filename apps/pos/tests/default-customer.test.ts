import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { Customer, SyncContext, TallyConnector } from '@tallyui/core';
import { customerSource } from '../lib/customers/customer-source';
import {
  DEFAULT_CUSTOMER_KEY, effectiveDefaultCustomerSetting, loadDefaultCustomerSetting, resolveDefaultCustomer,
  saveDefaultCustomerSetting, useDefaultCustomer, useDefaultCustomerSetting,
} from '../lib/customers/default-customer';
import { memoryStorage } from './memory-storage';

const siteA = 'https://a.example';
const siteB = 'https://b.example';
const user = { id: 2, displayName: 'Paul' };
const gee = { id: '7', name: 'Gee Four', email: 'gee@example.invalid' };
const cashierCustomer = { id: '2', name: 'Paul Kilmurray' };

let storage: Storage;
beforeEach(() => { storage = memoryStorage(); vi.stubGlobal('localStorage', storage); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('save and load round-trip one site\'s setting', () => {
  saveDefaultCustomerSetting(siteA, { customerId: 7, isCashier: false }, storage);
  expect(loadDefaultCustomerSetting(siteA, storage)).toEqual({ customerId: 7, isCashier: false });
});

test('the setting is keyed by site: another site has none, and saving one keeps the other', () => {
  saveDefaultCustomerSetting(siteA, { customerId: 7, isCashier: false }, storage);
  expect(loadDefaultCustomerSetting(siteB, storage)).toBeUndefined();
  saveDefaultCustomerSetting(siteB, { customerId: 0, isCashier: true }, storage);
  expect(loadDefaultCustomerSetting(siteA, storage)).toEqual({ customerId: 7, isCashier: false });
  expect(loadDefaultCustomerSetting(siteB, storage)).toEqual({ customerId: 0, isCashier: true });
  expect(Object.keys(JSON.parse(storage.getItem(DEFAULT_CUSTOMER_KEY)!))).toEqual([siteA, siteB]);
});

test.each([
  ['not JSON', '{'], ['an array', '[]'], ['a string', '"x"'],
  ['a negative id', JSON.stringify({ [siteA]: { customerId: -1, isCashier: false } })],
  ['a fractional id', JSON.stringify({ [siteA]: { customerId: 1.5, isCashier: false } })],
  ['a string id', JSON.stringify({ [siteA]: { customerId: '7', isCashier: false } })],
  ['a missing isCashier', JSON.stringify({ [siteA]: { customerId: 7 } })],
  ['a null entry', JSON.stringify({ [siteA]: null })],
])('a bad stored value (%s) loads as none', (_name, raw) => {
  storage.setItem(DEFAULT_CUSTOMER_KEY, raw);
  expect(loadDefaultCustomerSetting(siteA, storage)).toBeUndefined();
});

test('a throwing storage loads none and saving over it does not throw', () => {
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } } as unknown as Storage;
  expect(loadDefaultCustomerSetting(siteA, broken)).toBeUndefined();
  expect(() => saveDefaultCustomerSetting(siteA, { customerId: 7, isCashier: false }, broken)).not.toThrow();
});

test('saving over a corrupt value replaces it', () => {
  storage.setItem(DEFAULT_CUSTOMER_KEY, '{');
  saveDefaultCustomerSetting(siteA, { customerId: 3, isCashier: false }, storage);
  expect(loadDefaultCustomerSetting(siteA, storage)).toEqual({ customerId: 3, isCashier: false });
});

test('with no stored setting, the store\'s default customer and "is cashier" are used', () => {
  expect(effectiveDefaultCustomerSetting({ defaultCustomerId: 7, defaultCustomerIsCashier: true }, undefined))
    .toEqual({ customerId: 7, isCashier: true });
  expect(effectiveDefaultCustomerSetting({ defaultCustomerId: 7 }, undefined)).toEqual({ customerId: 7, isCashier: false });
  expect(effectiveDefaultCustomerSetting({}, undefined)).toEqual({ customerId: 0, isCashier: false });
});

test('a stored setting wins over the store\'s', () => {
  expect(effectiveDefaultCustomerSetting({ defaultCustomerId: 7, defaultCustomerIsCashier: true }, { customerId: 0, isCashier: false }))
    .toEqual({ customerId: 0, isCashier: false });
});

test('isCashier resolves the signed-in user\'s customer record', async () => {
  const getCustomer = vi.fn(async (id: string) => id === '2' ? { ...cashierCustomer, phone: '555' } as Customer : null);
  await expect(resolveDefaultCustomer({ customerId: 7, isCashier: true }, user, getCustomer)).resolves.toEqual(cashierCustomer);
  expect(getCustomer).toHaveBeenCalledWith('2');
});

test.each([
  ['gives null', async () => null],
  ['throws', async () => { throw new Error('offline'); }],
])('isCashier falls back to the user\'s id and display name when the lookup %s', async (_name, getCustomer) => {
  await expect(resolveDefaultCustomer({ customerId: 0, isCashier: true }, user, getCustomer)).resolves.toEqual({ id: '2', name: 'Paul' });
});

test('a chosen customer resolves through the lookup; Guest (0) asks nothing', async () => {
  const getCustomer = vi.fn(async (id: string) => id === '7' ? gee : null);
  await expect(resolveDefaultCustomer({ customerId: 7, isCashier: false }, user, getCustomer)).resolves.toEqual(gee);
  expect(getCustomer).toHaveBeenCalledWith('7');
  getCustomer.mockClear();
  await expect(resolveDefaultCustomer({ customerId: 0, isCashier: false }, user, getCustomer)).resolves.toBeNull();
  expect(getCustomer).not.toHaveBeenCalled();
});

test.each([
  ['gives null', async () => null],
  ['throws', async () => { throw new Error('offline'); }],
])('a chosen customer whose lookup %s is Guest', async (_name, getCustomer) => {
  await expect(resolveDefaultCustomer({ customerId: 7, isCashier: false }, user, getCustomer)).resolves.toBeNull();
});

test('useDefaultCustomerSetting follows a save made elsewhere without a reload', () => {
  const store = { defaultCustomerId: 7 };
  const first = renderHook(() => useDefaultCustomerSetting(siteA, store));
  const second = renderHook(() => useDefaultCustomerSetting(siteA, store));
  expect(first.result.current[0]).toEqual({ customerId: 7, isCashier: false });
  act(() => { second.result.current[1]({ customerId: 0, isCashier: true }); });
  expect(first.result.current[0]).toEqual({ customerId: 0, isCashier: true });
  expect(loadDefaultCustomerSetting(siteA)).toEqual({ customerId: 0, isCashier: true });
});

test('useDefaultCustomerSetting is undefined until the site and store are known', () => {
  expect(renderHook(() => useDefaultCustomerSetting(undefined, undefined)).result.current[0]).toBeUndefined();
  expect(renderHook(() => useDefaultCustomerSetting(siteA, undefined)).result.current[0]).toBeUndefined();
});

test('useDefaultCustomer is undefined while resolving, and re-resolves when the setting changes', async () => {
  let release!: () => void;
  const getCustomer = vi.fn((id: string) => new Promise<typeof gee | null>(resolve => {
    release = () => resolve(id === '7' ? gee : null);
  }));
  const { result, rerender } = renderHook(({ customerId }) => useDefaultCustomer({ customerId, isCashier: false }, user, getCustomer),
    { initialProps: { customerId: 7 } });
  expect(result.current).toBeUndefined();
  await act(async () => { release(); });
  expect(result.current).toEqual(gee);
  rerender({ customerId: 0 });
  await waitFor(() => expect(result.current).toBeNull());
  rerender({ customerId: 7 });
  expect(result.current).toBeUndefined();
  await act(async () => { release(); });
  expect(result.current).toEqual(gee);
});

test('useDefaultCustomer with isCashier and no lookup gives the signed-in user', async () => {
  const { result } = renderHook(() => useDefaultCustomer({ customerId: 0, isCashier: true }, user));
  await waitFor(() => expect(result.current).toEqual({ id: '2', name: 'Paul' }));
});

test('the customer source\'s get forwards to the connector\'s getCustomer with a fresh context', async () => {
  const context: SyncContext = { connectorId: 'woocommerce', baseUrl: 'https://shop.example', headers: {} };
  const getCustomer = vi.fn<NonNullable<TallyConnector['getCustomer']>>(async () => gee);
  const source = customerSource({ ...createWooCommerceConnector(), getCustomer }, () => context)!;
  await expect(source.get!('7')).resolves.toEqual(gee);
  expect(getCustomer).toHaveBeenCalledWith(context, '7');
  expect(customerSource({ ...createWooCommerceConnector(), getCustomer: undefined }, () => context)!.get).toBeUndefined();
});
