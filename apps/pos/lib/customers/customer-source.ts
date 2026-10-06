import type { Customer, CustomerInput, SyncContext, TallyConnector } from '@tallyui/core';

export interface CustomerSource {
  search(query: string): Promise<Customer[]>;
  create(input: CustomerInput): Promise<Customer>;
}

// G4, the customer methods in @tallyui/connector-woocommerce, plugs in here;
// until then the till sells to guests only (handoff M4-G4-customers-gap.md).
export function customerSource(connector: TallyConnector, context: () => SyncContext): CustomerSource | null {
  if (!connector.searchCustomers || !connector.createCustomer) return null;
  return {
    search: query => connector.searchCustomers!(context(), query, { limit: 20 }),
    create: input => connector.createCustomer!(context(), input),
  };
}
