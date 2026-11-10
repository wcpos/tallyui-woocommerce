import type { StoreOrder, StoreOrderPage, SyncContext, TallyConnector } from '@tallyui/core';
import type { OrderHistoryRow } from '@tallyui/components';

export interface OrderHistorySource {
  /** `search` is the platform's own order search; leave it out for every order. */
  list(page: number, search?: string): Promise<StoreOrderPage>;
}

export function orderHistorySource(connector: TallyConnector, context: () => SyncContext): OrderHistorySource | null {
  if (!connector.listOrders) return null;
  return { list: (page, search) => connector.listOrders!(context(), search ? { page, perPage: 25, search } : { page, perPage: 25 }) };
}

export interface SearchableOrder {
  id: string;
  lines: ReadonlyArray<{ name: string; sku?: string }>;
  customer: { name?: string; email?: string } | null;
  serverRefs?: { orderId: string; displayId?: string };
}
/** This till's own sales, matched by the same text as the store search: order id, store number, customer, line name or SKU. */
export function matchesOrderSearch(order: SearchableOrder, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [order.id, order.serverRefs?.orderId, order.serverRefs?.displayId,
    order.customer?.name, order.customer?.email, ...order.lines.flatMap(line => [line.name, line.sku])]
    .some(value => value?.toLowerCase().includes(needle));
}

// These are WooCommerce's own status names.
export const WOO_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending payment', processing: 'Processing', 'on-hold': 'On hold', completed: 'Completed',
  cancelled: 'Cancelled', refunded: 'Refunded', failed: 'Failed', 'checkout-draft': 'Draft',
};

export function toHistoryRow(order: StoreOrder): OrderHistoryRow {
  return {
    id: order.id, ...(order.clientOrderId !== undefined ? { clientOrderId: order.clientOrderId } : {}),
    reference: order.reference, placedAt: order.placedAt, totalMinor: order.totalMinor, currency: order.currency,
    itemCount: order.lines.reduce((sum, line) => sum + line.quantity, 0),
    stateLabel: WOO_STATUS_LABELS[order.status] ?? order.status.charAt(0).toUpperCase() + order.status.slice(1),
  };
}
