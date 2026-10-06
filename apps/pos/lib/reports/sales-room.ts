import { taxLinesByRate, type PosOrder } from '@tallyui/pos';
import { dayRange } from './today-sales';

export type MethodTile = { method: string; label: string; count: number; totalMinor: number };
export type TaxRateRow = { ratePpm: number; label: string; netMinor: number; taxMinor: number; grossMinor: number };
export type Period = {
  count: number; totalMinor: number; taxMinor: number; averageMinor: number;
  pending: number; rejected: number; splitCount: number;
  byMethod: MethodTile[]; taxRates: TaxRateRow[];
};
export type HourBucket = {
  hour: number;
  today: { count: number; totalMinor: number };
  yesterday: { count: number; totalMinor: number };
};
export type SalesRoom = {
  today: Period;
  yesterday: Period;
  yesterdaySoFar: { count: number; totalMinor: number; averageMinor: number };
  delta: { totalMinor: number; percentTenths: number | null; count: number; averageMinor: number };
  hours: HourBucket[];
};

export function salesRoom(orders: readonly PosOrder[], options: { now: Date; currency: string }): SalesRoom {
  const { now, currency } = options;
  const [year, month, day] = [now.getFullYear(), now.getMonth(), now.getDate()];
  const ranges = [dayRange(now), dayRange(new Date(year, month, day - 1))];
  const cutoff = new Date(year, month, day - 1, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()).toISOString();
  const yesterdaySoFar = { count: 0, totalMinor: 0, averageMinor: 0 };
  const buckets = new Map<number, HourBucket>();
  const [today, yesterday] = ranges.map(({ startIso, endIso }, index): Period => {
    const period: Period = {
      count: 0, totalMinor: 0, taxMinor: 0, averageMinor: 0,
      pending: 0, rejected: 0, splitCount: 0, byMethod: [], taxRates: [],
    };
    for (const order of orders) {
      if (order.currency !== currency || order.createdAt < startIso || order.createdAt >= endIso) continue;
      period.count++;
      period.totalMinor += order.totalMinor;
      period.taxMinor += order.taxMinor;
      if (order.syncStatus === 'pending') period.pending++;
      if (order.syncStatus === 'rejected') period.rejected++;
      if (order.payments.length > 1) period.splitCount++;
      const methods = new Set<string>();
      for (const payment of order.payments) {
        let tile = period.byMethod.find(row => row.method === payment.method);
        if (!tile) {
          tile = { method: payment.method, label: payment.method === 'cash' ? 'Cash' : 'Card terminal', count: 0, totalMinor: 0 };
          period.byMethod.push(tile);
        }
        if (!methods.has(payment.method)) tile.count++;
        methods.add(payment.method);
        tile.totalMinor += payment.amountMinor;
      }
      const lines = order.lines.map(line => ({ ...line, taxInclusive: line.taxInclusive ?? order.pricesIncludeTax }));
      for (const { ratePpm, netMinor, amountMinor } of taxLinesByRate([
        ...lines, ...[...order.fees ?? [], ...order.shipping ?? []].map(c => ({ ...c, taxInclusive: order.pricesIncludeTax })),
      ], order.taxMinor, undefined, order.taxRounding)) {
        let row = period.taxRates.find(row => row.ratePpm === ratePpm);
        if (!row) {
          row = { ratePpm, label: `Tax ${ratePpm / 1e4}%`, netMinor: 0, taxMinor: 0, grossMinor: 0 };
          period.taxRates.push(row);
        }
        row.netMinor += netMinor;
        row.taxMinor += amountMinor;
        row.grossMinor = row.netMinor + row.taxMinor;
      }
      if (index === 1 && order.createdAt < cutoff) {
        yesterdaySoFar.count++;
        yesterdaySoFar.totalMinor += order.totalMinor;
      }
      const hour = new Date(order.createdAt).getHours();
      let bucket = buckets.get(hour);
      if (!bucket) {
        bucket = { hour, today: { count: 0, totalMinor: 0 }, yesterday: { count: 0, totalMinor: 0 } };
        buckets.set(hour, bucket);
      }
      const hourly = index === 0 ? bucket.today : bucket.yesterday;
      hourly.count++;
      hourly.totalMinor += order.totalMinor;
    }
    period.averageMinor = period.count === 0 ? 0 : Math.round(period.totalMinor / period.count);
    period.taxRates.sort((a, b) => a.ratePpm - b.ratePpm);
    return period;
  });
  yesterdaySoFar.averageMinor = yesterdaySoFar.count === 0 ? 0 : Math.round(yesterdaySoFar.totalMinor / yesterdaySoFar.count);
  const totalMinor = today.totalMinor - yesterdaySoFar.totalMinor;
  const hours: HourBucket[] = [];
  if (buckets.size > 0) {
    const first = Math.min(...buckets.keys());
    const last = Math.max(...buckets.keys());
    for (let hour = first; hour <= last; hour++) {
      hours.push(buckets.get(hour) ?? {
        hour, today: { count: 0, totalMinor: 0 }, yesterday: { count: 0, totalMinor: 0 },
      });
    }
  }
  return {
    today, yesterday, yesterdaySoFar,
    delta: {
      totalMinor,
      percentTenths: yesterdaySoFar.totalMinor === 0 ? null : Math.round(totalMinor * 1000 / yesterdaySoFar.totalMinor),
      count: today.count - yesterdaySoFar.count,
      averageMinor: today.averageMinor - yesterdaySoFar.averageMinor,
    },
    hours,
  };
}
