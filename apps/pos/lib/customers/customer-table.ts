import type { Customer } from '@tallyui/core';
import { getInitials } from '../cashier/initials';

// v2 customers/index.tsx:51-60 CUSTOMER_SORT_FIELDS that a store Customer carries.
export type CustomerSortField = 'id' | 'first_name' | 'last_name' | 'email' | 'date_created_gmt';
export interface CustomerSort { field: CustomerSortField; direction: 'asc' | 'desc' }
// v2 packages/core/src/screens/main/customers/index.tsx default sort.
export const DEFAULT_CUSTOMER_SORT: CustomerSort = { field: 'last_name', direction: 'asc' };

const SORT_KEY: Record<Exclude<CustomerSortField, 'id' | 'date_created_gmt'>, 'firstName' | 'lastName' | 'email'> = {
  first_name: 'firstName',
  last_name: 'lastName',
  email: 'email',
};

// v2 packages/components/src/avatar/index.tsx getInitials, with cells/avatar.tsx's email-local-part fallback.
export function customerInitials(customer: Pick<Customer, 'name' | 'email'>): string {
  const email = customer.email ?? '';
  return getInitials(email && customer.name === email ? email.split('@')[0] : customer.name);
}

// v2 packages/components/src/format/address.tsx (FormatAddress showName): the name, then the company.
export function billingLines(customer: Pick<Customer, 'firstName' | 'lastName' | 'company'>): string[] {
  const name = [customer.firstName, customer.lastName].map(part => (part ?? '').trim()).filter(Boolean).join(' ');
  const company = customer.company ?? '';
  return [...(name ? [name] : []), ...(company ? [company] : [])];
}

// v2 packages/core/src/screens/main/customers/index.tsx sorting, applied to the loaded results.
// id sorts numerically; date_created_gmt by time (Customer.createdAt, ISO 8601), a customer with no date first.
export function sortCustomers(customers: readonly Customer[], sort: CustomerSort): Customer[] {
  const { field } = sort;
  const sign = sort.direction === 'desc' ? -1 : 1;
  const time = (c: Customer) => (c.createdAt ? Date.parse(c.createdAt) : -Infinity);
  const byField = (a: Customer, b: Customer) => field === 'id' ? 0
    : field === 'date_created_gmt' ? Math.sign(time(a) - time(b)) || 0
    : (a[SORT_KEY[field]] ?? '').localeCompare(b[SORT_KEY[field]] ?? '', undefined, { sensitivity: 'base' });
  return [...customers].sort((a, b) => sign * (byField(a, b) || a.id.localeCompare(b.id, undefined, { numeric: true })));
}

// v2 packages/components/src/data-table/header.tsx: the sorted column flips, another column starts ascending.
export function nextSort(current: CustomerSort, field: CustomerSortField): CustomerSort {
  if (current.field === field) return { field, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  return { field, direction: 'asc' };
}
