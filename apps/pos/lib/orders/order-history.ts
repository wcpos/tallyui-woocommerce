import type { StoreOrder, StoreOrderPage, SyncContext, TallyConnector } from '@tallyui/core';
import type { OrderHistoryRow } from '@tallyui/components';

export interface OrderHistorySource {
  list(page: number): Promise<StoreOrderPage>;
}

export function orderHistorySource(connector: TallyConnector, context: () => SyncContext): OrderHistorySource | null {
  if (!connector.listOrders) return null;
  return { list: page => connector.listOrders!(context(), { page, perPage: 25 }) };
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
