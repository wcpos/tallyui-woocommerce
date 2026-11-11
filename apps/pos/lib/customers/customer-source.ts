import type { Customer, CustomerInput, SyncContext, TallyConnector } from '@tallyui/core';

export interface CustomerSource {
  search(query: string): Promise<Customer[]>;
  create(input: CustomerInput): Promise<Customer>;
  /** One customer by id, null when the store has none; absent when the connector cannot look one up. */
  get?(id: string): Promise<Customer | null>;
}

// The WooCommerce connector provides these methods from TallyUI 3.1.1 (G4).
export function customerSource(connector: TallyConnector, context: () => SyncContext): CustomerSource | null {
  if (!connector.searchCustomers || !connector.createCustomer) return null;
  return {
    search: query => connector.searchCustomers!(context(), query, { limit: 20 }),
    create: input => connector.createCustomer!(context(), input),
    ...(connector.getCustomer ? { get: (id: string) => connector.getCustomer!(context(), id) } : {}),
  };
}
