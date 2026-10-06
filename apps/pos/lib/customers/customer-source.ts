import type { Customer, CustomerInput, SyncContext, TallyConnector } from '@tallyui/core';

export interface CustomerSource {
  search(query: string): Promise<Customer[]>;
  create(input: CustomerInput): Promise<Customer>;
}

// The WooCommerce connector provides these methods from TallyUI 3.1.1 (G4).
export function customerSource(connector: TallyConnector, context: () => SyncContext): CustomerSource | null {
  if (!connector.searchCustomers || !connector.createCustomer) return null;
  return {
    search: query => connector.searchCustomers!(context(), query, { limit: 20 }),
    create: input => connector.createCustomer!(context(), input),
  };
}
