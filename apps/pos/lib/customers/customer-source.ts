import type { Customer, CustomerInput, CustomerPage, CustomerPatch, SyncContext, TallyConnector } from '@tallyui/core';

export interface CustomerSource {
  search(query: string): Promise<Customer[]>;
  /** The first page of a search with the store's count of every match; absent when the connector can't count. */
  searchPage?(query: string): Promise<CustomerPage>;
  create(input: CustomerInput): Promise<Customer>;
  /** One customer by id, null when the store has none; absent when the connector cannot look one up. */
  get?(id: string): Promise<Customer | null>;
  /** Update one customer by id; absent when the connector cannot update customers. */
  update?(id: string, patch: CustomerPatch): Promise<Customer>;
}

// The WooCommerce connector provides these methods from TallyUI 3.1.1 (G4).
export function customerSource(connector: TallyConnector, context: () => SyncContext): CustomerSource | null {
  if (!connector.searchCustomers || !connector.createCustomer) return null;
  return {
    search: query => connector.searchCustomers!(context(), query, { limit: 20 }),
    create: input => connector.createCustomer!(context(), input),
    ...(connector.searchCustomersPage ? { searchPage: (query: string) => connector.searchCustomersPage!(context(), query, { limit: 20 }) } : {}),
    ...(connector.getCustomer ? { get: (id: string) => connector.getCustomer!(context(), id) } : {}),
    ...(connector.updateCustomer ? { update: (id: string, patch: CustomerPatch) => connector.updateCustomer!(context(), id, patch) } : {}),
  };
}
