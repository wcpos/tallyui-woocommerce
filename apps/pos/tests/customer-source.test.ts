import { expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { Customer, SyncContext, TallyConnector } from '@tallyui/core';
import { customerSource } from '../lib/customers/customer-source';

const customer: Customer = { id: '7', name: 'Gee Four', email: 'gee@example.invalid' };
const context: SyncContext = { connectorId: 'woocommerce', baseUrl: 'https://shop.example', headers: { Authorization: 'Bearer first' } };

test('the installed WooCommerce connector gives a customer source', () => {
  expect(customerSource(createWooCommerceConnector(), () => context)).not.toBeNull();
});

test.each(['searchCustomers', 'createCustomer'] as const)('no source without %s', missing => {
  const connector: TallyConnector = {
    ...createWooCommerceConnector(),
    searchCustomers: vi.fn(async () => [customer]), createCustomer: vi.fn(async () => customer),
    [missing]: undefined,
  };
  expect(customerSource(connector, () => context)).toBeNull();
});

test('forwards search and create with a fresh context on every call', async () => {
  const searchCustomers = vi.fn<NonNullable<TallyConnector['searchCustomers']>>(async () => [customer]);
  const createCustomer = vi.fn<NonNullable<TallyConnector['createCustomer']>>(async () => customer);
  let token = 'first';
  const getContext = vi.fn(() => ({ ...context, headers: { Authorization: `Bearer ${token}` } }));
  const source = customerSource({ ...createWooCommerceConnector(), searchCustomers, createCustomer }, getContext)!;
  expect(getContext).not.toHaveBeenCalled();
  await expect(source.search('gee')).resolves.toEqual([customer]);
  expect(searchCustomers).toHaveBeenNthCalledWith(1, context, 'gee', { limit: 20 });
  token = 'second';
  await source.search('four');
  expect(searchCustomers).toHaveBeenNthCalledWith(2, { ...context, headers: { Authorization: 'Bearer second' } }, 'four', { limit: 20 });
  const input = { email: customer.email!, firstName: 'Gee', lastName: 'Four' };
  await expect(source.create(input)).resolves.toEqual(customer);
  expect(createCustomer).toHaveBeenNthCalledWith(1, { ...context, headers: { Authorization: 'Bearer second' } }, input);
  token = 'third';
  await source.create(input);
  expect(createCustomer).toHaveBeenNthCalledWith(2, { ...context, headers: { Authorization: 'Bearer third' } }, input);
  expect(getContext).toHaveBeenCalledTimes(4);
});

test('searchPage forwards the page call with limit 20 and a fresh context, keeping the total', async () => {
  const searchCustomers = vi.fn<NonNullable<TallyConnector['searchCustomers']>>(async () => [customer]);
  const createCustomer = vi.fn<NonNullable<TallyConnector['createCustomer']>>(async () => customer);
  const searchCustomersPage = vi.fn<NonNullable<TallyConnector['searchCustomersPage']>>(async () => ({ customers: [customer], total: 57 }));
  const source = customerSource({ ...createWooCommerceConnector(), searchCustomers, createCustomer, searchCustomersPage }, () => context)!;
  await expect(source.searchPage!('gee')).resolves.toEqual({ customers: [customer], total: 57 });
  expect(searchCustomersPage).toHaveBeenCalledWith(context, 'gee', { limit: 20 });
  expect(searchCustomers).not.toHaveBeenCalled();
});

test('no searchPage when the connector cannot count', () => {
  const source = customerSource({ ...createWooCommerceConnector(), searchCustomersPage: undefined }, () => context)!;
  expect(source.searchPage).toBeUndefined();
});

test('update forwards the context, id and patch and returns the saved customer', async () => {
  const updateCustomer = vi.fn<NonNullable<TallyConnector['updateCustomer']>>().mockResolvedValue(customer);
  const source = customerSource({ ...createWooCommerceConnector(), updateCustomer }, () => context)!;
  expect(source.update).toBeTypeOf('function');
  const patch = { phone: '456' };
  await expect(source.update!('7', patch)).resolves.toBe(customer);
  expect(updateCustomer).toHaveBeenCalledExactlyOnceWith(context, '7', patch);
});

test('no update when the connector cannot update customers', () => {
  const source = customerSource({ ...createWooCommerceConnector(), updateCustomer: undefined }, () => context)!;
  expect(source).not.toHaveProperty('update');
});
