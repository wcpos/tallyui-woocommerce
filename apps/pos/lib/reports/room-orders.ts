import type { StoreOrder } from '@tallyui/core';
import { replacedOrderIds, taxLinesByRate, type PosOrder } from '@tallyui/pos';

export type ReportStatusMode = 'done' | 'all';
/** v2 reports/context.tsx:174-177: the order statuses each mode counts. */
export const REPORT_STATUSES: Record<ReportStatusMode, readonly string[]> = {
  done: ['completed', 'processing'],
  all: ['completed', 'processing', 'pending', 'on-hold'],
};
export type RoomPayment = { method: string; label: string; amountMinor: number; cash: boolean };
export type RoomTaxRate = { ratePpm: number; label: string; netMinor: number | null; taxMinor: number };
export type RoomOrder = {
  key: string; at: Date; currency: string; totalMinor: number; taxMinor: number; discountMinor: number;
  items: number; cashierRef: string | null;
  state: 'store' | 'pending' | 'applied' | 'rejected';
  /** In the totals: a store order whose status the mode counts, or a local pending/applied order. */
  counted: boolean;
  payments: RoomPayment[]; taxRates: RoomTaxRate[];
  refundedMinor: number;
};

export function roomOrdersFromLocal(orders: readonly PosOrder[], replaced: ReadonlySet<string> = replacedOrderIds(orders)): RoomOrder[] {
  // The outbox's own rule: a refused order a later sale replaced counts through that sale; the caller may pass the replaced set it worked out from more orders than these.
  return orders.filter(order => order.syncStatus !== 'rejected' || !replaced.has(order.id)).map(order => {
    const lines = order.lines.map(line => ({ ...line, taxInclusive: line.taxInclusive ?? order.pricesIncludeTax }));
    return {
      key: order.id, at: new Date(order.createdAt), currency: order.currency,
      totalMinor: order.totalMinor, taxMinor: order.taxMinor, discountMinor: order.discountMinor,
      items: order.lines.reduce((sum, line) => sum + line.quantity, 0), cashierRef: order.cashierRef ?? null,
      state: order.syncStatus, counted: order.syncStatus !== 'rejected',
      payments: order.payments.map(({ method, amountMinor }) => ({
        method, label: method === 'cash' ? 'Cash' : 'Card terminal', amountMinor, cash: method === 'cash',
      })),
      taxRates: taxLinesByRate([
        ...lines, ...[...order.fees ?? [], ...order.shipping ?? []].map(c => ({ ...c, taxInclusive: order.pricesIncludeTax })),
      ], order.taxMinor, undefined, order.taxRounding).map(({ ratePpm, netMinor, amountMinor }) => ({
        ratePpm, label: `Tax ${ratePpm / 1e4}%`, netMinor, taxMinor: amountMinor,
      })),
      refundedMinor: 0,
    };
  });
}

export function roomOrderFromStoreOrder(order: StoreOrder, mode: ReportStatusMode, local?: PosOrder): RoomOrder {
  const counted = REPORT_STATUSES[mode].includes(order.status);
  const payments: RoomPayment[] = order.paymentRecordUnreadable
    ? [{ method: 'unknown', label: 'Not read', amountMinor: order.totalMinor, cash: false }]
    : order.payments.map(({ method, title, kind, amountMinor }) => ({
      method: kind ?? method,
      label: kind === 'cash' ? 'Cash' : kind === 'external' ? 'Card terminal' : title ?? method,
      amountMinor, cash: (kind ?? method) === 'cash',
    }));
  const paidMinor = payments.reduce((sum, payment) => sum + payment.amountMinor, 0);
  if (paidMinor < order.totalMinor) {
    payments.push({ method: 'unpaid', label: 'Unpaid', amountMinor: order.totalMinor - paidMinor, cash: false });
  }
  return {
    key: order.clientOrderId ?? `store:${order.id}`, at: new Date(local ? local.createdAt : order.placedAt),
    currency: order.currency, totalMinor: order.totalMinor, taxMinor: order.taxMinor, discountMinor: order.discountMinor,
    items: order.lines.reduce((sum, line) => sum + line.quantity, 0), cashierRef: local?.cashierRef ?? null,
    state: 'store', counted, payments,
    taxRates: order.taxLines.map(({ ratePpm, label, amountMinor }) => ({
      ratePpm, label: label || `Tax ${ratePpm / 1e4}%`, netMinor: null, taxMinor: amountMinor,
    })),
    // v2 counts every refund in the period, whatever its order's status (report/sales-figures.ts:63-89).
    refundedMinor: order.refunds.reduce((sum, refund) => sum + refund.amountMinor, 0),
  };
}

export function mergeRoomOrders(store: readonly StoreOrder[], local: readonly PosOrder[], mode: ReportStatusMode, replaced?: ReadonlySet<string>): RoomOrder[] {
  const joined = new Set<string>();
  const orders = store.map(order => {
    const match = local.find(candidate => candidate.id === order.clientOrderId);
    if (match) joined.add(match.id);
    return roomOrderFromStoreOrder(order, mode, match);
  });
  return [...orders, ...roomOrdersFromLocal(local, replaced).filter(order => !joined.has(order.key))];
}
