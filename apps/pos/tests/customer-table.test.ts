import { expect, test } from 'vitest';
import type { Customer } from '@tallyui/core';
import { DEFAULT_CUSTOMER_SORT, billingLines, customerInitials, sortCustomers } from '../lib/customers/customer-table';
import { nextSort } from '../lib/table-sort';

test('initials take the first and last word, two letters of one word, and ? for none', () => {
  expect(customerInitials({ name: 'Gee Four' })).toBe('GF');
  expect(customerInitials({ name: 'ada king lovelace' })).toBe('AL');
  expect(customerInitials({ name: 'Cher' })).toBe('CH');
  expect(customerInitials({ name: '   ' })).toBe('?');
});

test('initials use the email local part when the name is the email', () => {
  expect(customerInitials({ name: 'z@example.invalid', email: 'z@example.invalid' })).toBe('Z');
  expect(customerInitials({ name: 'zed@example.invalid', email: 'zed@example.invalid' })).toBe('ZE');
});

test('billing lines are the name then the company', () => {
  expect(billingLines({ firstName: 'Gee', lastName: 'Four', company: 'Four Co' })).toEqual(['Gee Four', 'Four Co']);
  expect(billingLines({ lastName: ' Four ' })).toEqual(['Four']);
  expect(billingLines({})).toEqual([]);
});

const byLastName: Customer[] = [
  { id: '10', name: 'b', lastName: 'lovelace' },
  { id: '2', name: 'a', lastName: 'Lovelace' },
  { id: '3', name: 'c', lastName: 'Brown' },
  { id: '4', name: 'd' },
];

test('customers sort by last name ascending by default, ignoring case, then by id', () => {
  const list = [...byLastName];
  expect(sortCustomers(list, DEFAULT_CUSTOMER_SORT).map(c => c.id)).toEqual(['4', '3', '2', '10']);
  expect(list.map(c => c.id)).toEqual(['10', '2', '3', '4']);
});

test('descending reverses the order, tie-break included', () => {
  expect(sortCustomers(byLastName, { field: 'last_name', direction: 'desc' }).map(c => c.id)).toEqual(['10', '2', '3', '4']);
});

test('first name and email sort by their own field', () => {
  expect(sortCustomers([{ id: '1', name: 'x', firstName: 'Cy' }, { id: '2', name: 'y', firstName: 'ada' }],
    { field: 'first_name', direction: 'asc' }).map(c => c.id)).toEqual(['2', '1']);
  expect(sortCustomers([{ id: '1', name: 'x', email: 'b@x.invalid' }, { id: '2', name: 'y', email: 'a@x.invalid' }],
    { field: 'email', direction: 'asc' }).map(c => c.id)).toEqual(['2', '1']);
});

test('pressing the sorted column flips it and another column starts ascending', () => {
  expect(nextSort({ field: 'last_name', direction: 'asc' }, 'last_name')).toEqual({ field: 'last_name', direction: 'desc' });
  expect(nextSort({ field: 'last_name', direction: 'desc' }, 'last_name')).toEqual({ field: 'last_name', direction: 'asc' });
  expect(nextSort({ field: 'last_name', direction: 'desc' }, 'email')).toEqual({ field: 'email', direction: 'asc' });
});

// v2 customers/index.tsx:51-60: id and date_created_gmt are sort fields.
test('id sorts numerically: 9 before 10, descending reverses', () => {
  const list: Customer[] = [{ id: '10', name: 'a' }, { id: '9', name: 'b' }, { id: '100', name: 'c' }];
  expect(sortCustomers(list, { field: 'id', direction: 'asc' }).map(c => c.id)).toEqual(['9', '10', '100']);
  expect(sortCustomers(list, { field: 'id', direction: 'desc' }).map(c => c.id)).toEqual(['100', '10', '9']);
});

test('date created sorts by time with no date first ascending, and descending reverses', () => {
  const list: Customer[] = [
    { id: '1', name: 'newest', createdAt: '2026-10-06T03:10:29Z' },
    { id: '2', name: 'oldest', createdAt: '2023-08-21T12:00:00Z' },
    { id: '3', name: 'none' },
    { id: '4', name: 'newer', createdAt: '2025-01-02T00:00:00Z' },
  ];
  expect(sortCustomers(list, { field: 'date_created_gmt', direction: 'asc' }).map(c => c.name)).toEqual(['none', 'oldest', 'newer', 'newest']);
  expect(sortCustomers(list, { field: 'date_created_gmt', direction: 'desc' }).map(c => c.name)).toEqual(['newest', 'newer', 'oldest', 'none']);
});
