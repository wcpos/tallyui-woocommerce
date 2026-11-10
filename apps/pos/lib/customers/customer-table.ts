import type { Customer } from '@tallyui/core';

export type CustomerSortField = 'first_name' | 'last_name' | 'email';
export interface CustomerSort { field: CustomerSortField; direction: 'asc' | 'desc' }
// v2 packages/core/src/screens/main/customers/index.tsx default sort.
export const DEFAULT_CUSTOMER_SORT: CustomerSort = { field: 'last_name', direction: 'asc' };

const SORT_KEY: Record<CustomerSortField, 'firstName' | 'lastName' | 'email'> = {
  first_name: 'firstName',
  last_name: 'lastName',
  email: 'email',
};

// v2 packages/components/src/avatar/index.tsx getInitials, with cells/avatar.tsx's email-local-part fallback.
export function customerInitials(customer: Pick<Customer, 'name' | 'email'>): string {
  const email = customer.email ?? '';
  const name = email && customer.name === email ? email.split('@')[0] : customer.name;
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '?';
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

// v2 packages/components/src/format/address.tsx (FormatAddress showName): the name, then the company.
export function billingLines(customer: Pick<Customer, 'firstName' | 'lastName' | 'company'>): string[] {
  const name = [customer.firstName, customer.lastName].map(part => (part ?? '').trim()).filter(Boolean).join(' ');
  const company = customer.company ?? '';
  return [...(name ? [name] : []), ...(company ? [company] : [])];
}

// v2 packages/core/src/screens/main/customers/index.tsx sorting, applied to the loaded results.
export function sortCustomers(customers: readonly Customer[], sort: CustomerSort): Customer[] {
  const key = SORT_KEY[sort.field];
  const sign = sort.direction === 'desc' ? -1 : 1;
  return [...customers].sort((a, b) => sign * (
    (a[key] ?? '').localeCompare(b[key] ?? '', undefined, { sensitivity: 'base' })
    || a.id.localeCompare(b.id, undefined, { numeric: true })
  ));
}

// v2 packages/components/src/data-table/header.tsx: the sorted column flips, another column starts ascending.
export function nextSort(current: CustomerSort, field: CustomerSortField): CustomerSort {
  if (current.field === field) return { field, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  return { field, direction: 'asc' };
}
