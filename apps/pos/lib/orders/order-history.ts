import type { ListOrdersQuery, OrderFilterField, StoreOrder, StoreOrderPage, SyncContext, TallyConnector } from '@tallyui/core';
import type { OrderHistoryRow } from '@tallyui/components';
import { orderFiltersQuery, type OrderFilterValue, type PosOrder } from '@tallyui/pos';

export interface OrderHistorySource {
  /** The connector's orderFilters; absent or [] when it has none. */
  fields?: readonly OrderFilterField[];
  /** `search` is the platform's own order search; `filters` the bar's fields (orderFiltersQuery). */
  list(page: number, search?: string, filters?: Pick<ListOrdersQuery, OrderFilterField>): Promise<StoreOrderPage>;
}

export function orderHistorySource(connector: TallyConnector, context: () => SyncContext): OrderHistorySource | null {
  if (!connector.listOrders) return null;
  return { fields: connector.orderFilters ?? [],
    list: (page, search, filters) => connector.listOrders!(context(), { page, perPage: 25, ...(search ? { search } : {}), ...filters }) };
}

/** WooCommerce's created_via words for the store pill (v2 store-pill.tsx: POS, Online Store, WP Admin). */
export const WOO_CREATED_VIA_OPTIONS = [
  { value: 'woocommerce-pos', label: 'POS' }, { value: 'checkout', label: 'Online Store' }, { value: 'admin', label: 'WP Admin' },
];

/** v2's resting scope (orders/index.tsx:294-300): this cashier's POS orders. Only the fields the connector filters on. */
export function initialOrderFilters(fields: readonly OrderFilterField[], cashierId: string | undefined): OrderFilterValue {
  return { ...(fields.includes('cashierId') && cashierId !== undefined ? { cashierId } : {}),
    ...(fields.includes('createdVia') ? { createdVia: 'woocommerce-pos' } : {}) };
}

/** Whether one of this till's own sales passes the bar's filters, judged from what the till knows. */
export function matchesOrderFilters(order: Pick<PosOrder, 'createdAt' | 'customer'>, value: OrderFilterValue, cashierId: string | undefined, timezone: string): boolean {
  if (value.cashierId !== undefined && value.cashierId !== cashierId) return false;
  if (value.createdVia !== undefined && value.createdVia !== 'woocommerce-pos') return false;
  if (value.storeId !== undefined || value.registerId !== undefined || value.paymentMethod !== undefined) return false;
  if (value.status !== undefined && value.status !== 'completed') return false;
  if (value.customerId !== undefined && (value.customerId === '0' ? !!order.customer?.id : value.customerId !== order.customer?.id)) return false;
  const range = value.dateRange ? orderFiltersQuery({ dateRange: value.dateRange }, timezone).dateRange : undefined;
  const at = Date.parse(order.createdAt);
  return (range?.after === undefined || at >= Date.parse(range.after)) && (range?.before === undefined || at < Date.parse(range.before));
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

/** WooCommerce's own name for a status word, else the word capitalised. */
export function wooStatusLabel(status: string): string {
  return WOO_STATUS_LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
}

export function toHistoryRow(order: StoreOrder): OrderHistoryRow {
  return {
    id: order.id, ...(order.clientOrderId !== undefined ? { clientOrderId: order.clientOrderId } : {}),
    reference: order.reference, placedAt: order.placedAt, totalMinor: order.totalMinor, currency: order.currency,
    itemCount: order.lines.reduce((sum, line) => sum + line.quantity, 0),
    stateLabel: wooStatusLabel(order.status),
  };
}
