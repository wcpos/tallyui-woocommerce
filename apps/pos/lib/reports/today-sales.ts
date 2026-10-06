import type { PosOrder } from '@tallyui/pos';

export function dayRange(now: Date): { startIso: string; endIso: string } {
  const [year, month, day] = [now.getFullYear(), now.getMonth(), now.getDate()];
  return {
    startIso: new Date(year, month, day).toISOString(),
    endIso: new Date(year, month, day + 1).toISOString(),
  };
}

export function summarizeSales(orders: PosOrder[], currency: string) {
  const byMethod: Array<{ method: PosOrder['payments'][number]['method']; label: string; count: number; totalMinor: number }> = [];
  const summary = { count: 0, totalMinor: 0, taxMinor: 0, byMethod, pending: 0, rejected: 0 };
  for (const order of orders.filter(order => order.currency === currency)) {
    summary.count++;
    summary.totalMinor += order.totalMinor;
    summary.taxMinor += order.taxMinor;
    if (order.syncStatus === 'pending') summary.pending++;
    if (order.syncStatus === 'rejected') summary.rejected++;
    for (const payment of order.payments) {
      let row = byMethod.find(row => row.method === payment.method);
      if (!row) {
        row = { method: payment.method, label: payment.method === 'cash' ? 'Cash' : 'Card terminal', count: 0, totalMinor: 0 };
        if (payment.method === 'cash') byMethod.unshift(row);
        else byMethod.push(row);
      }
      row.count++;
      row.totalMinor += payment.amountMinor;
    }
  }
  return summary;
}
