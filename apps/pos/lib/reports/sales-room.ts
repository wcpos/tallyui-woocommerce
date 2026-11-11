import { daysOf, taxLinesByRate, type DatePreset, type DayRange, type PosOrder } from '@tallyui/pos';

/** A device-local store day (`yyyy-MM-dd`) at midnight, `plus` days on. */
const localDay = (day: string, plus = 0) => {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date + plus);
};
/** The device-local store day of a moment. */
export const storeDay = (at: Date) =>
  `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
/** A range's instants: its first day's midnight up to the midnight after its last day. */
export const rangeBounds = (range: DayRange) =>
  ({ startIso: localDay(range.from).toISOString(), endIso: localDay(range.to, 1).toISOString() });
/** A week or month preset (v2 context `period` other than `day`), or any range longer than a day. */
export const isMultiDay = (range: DayRange, preset?: DatePreset) =>
  preset ? preset !== 'today' && preset !== 'yesterday' : range.from !== range.to;

/** The day a live day is compared with: yesterday, or the same weekday a week before (v2 reports/context.tsx `cmp`). */
export type Compare = 'yesterday' | 'lastweek';
export type MethodTile = { method: string; label: string; count: number; totalMinor: number };
export type TaxRateRow = { ratePpm: number; label: string; netMinor: number; taxMinor: number; grossMinor: number };
export type Period = {
  count: number; totalMinor: number; taxMinor: number; averageMinor: number;
  /** Units sold: the sum of line quantities. */
  items: number;
  /** The median order total; an even count averages the middle two (v2 aggregate.ts ordersSummary). 0 with no orders. */
  medianMinor: number;
  /** The largest order total; null with no orders. */
  largestMinor: number | null;
  /** The sum of the orders' discountMinor. */
  discountMinor: number;
  pending: number; rejected: number; splitCount: number;
  byMethod: MethodTile[]; taxRates: TaxRateRow[];
};
export type HourBucket = {
  /** The hour of day of `minute`; on a multi-day period, the day's index in the period. */
  hour: number;
  /** The bucket's start in minutes after the store day's midnight; 0 on a multi-day period. */
  minute: number;
  /** A multi-day period's store day; absent on an hourly bucket. */
  day?: string;
  today: { count: number; totalMinor: number };
  yesterday: { count: number; totalMinor: number };
};
export type SalesRoom = {
  today: Period;
  /** The comparison day (yesterday, or the same weekday last week); the names keep the default's. */
  yesterday: Period;
  yesterdaySoFar: { count: number; totalMinor: number; averageMinor: number; items: number };
  delta: { totalMinor: number; percentTenths: number | null; count: number; averageMinor: number; items: number };
  hours: HourBucket[];
};

/** v2 reports/chart/utils.ts NICE_MINUTE_INTERVALS: a single day's bar sizes in minutes, for at most 12 bars. */
const NICE_STEPS = [30, 60, 90, 120, 180, 240, 300, 360];
const emptyBucket = (hour: number, minute: number): HourBucket =>
  ({ hour, minute, today: { count: 0, totalMinor: 0 }, yesterday: { count: 0, totalMinor: 0 } });

/**
 * The period's figures (`today`, the names kept from the one-day room) against its comparison range.
 * A range that ends today is live: the comparison's last day counts only up to now's time of day.
 */
export function salesRoom(orders: readonly PosOrder[], options: {
  now: Date; currency: string; range: DayRange; preset?: DatePreset; comparison: DayRange;
}): SalesRoom {
  const { now, currency, range, preset, comparison } = options;
  const ranges = [rangeBounds(range), rangeBounds(comparison)];
  const last = localDay(comparison.to);
  const cutoff = range.to !== storeDay(now) ? ranges[1].endIso
    : new Date(last.getFullYear(), last.getMonth(), last.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()).toISOString();
  const days = isMultiDay(range, preset) ? [daysOf(range), daysOf(comparison)] : null;
  const yesterdaySoFar = { count: 0, totalMinor: 0, averageMinor: 0, items: 0 };
  const buckets = new Map<number, HourBucket>();
  // A single day's sales as minutes of their own day, both days on one clock.
  const sold: { minute: number; index: number; totalMinor: number }[] = [];
  const [today, yesterday] = ranges.map(({ startIso, endIso }, index): Period => {
    const period: Period = {
      count: 0, totalMinor: 0, taxMinor: 0, averageMinor: 0, items: 0,
      medianMinor: 0, largestMinor: null, discountMinor: 0,
      pending: 0, rejected: 0, splitCount: 0, byMethod: [], taxRates: [],
    };
    const totals: number[] = [];
    for (const order of orders) {
      if (order.currency !== currency || order.createdAt < startIso || order.createdAt >= endIso) continue;
      const items = order.lines.reduce((sum, line) => sum + line.quantity, 0);
      period.count++;
      period.totalMinor += order.totalMinor;
      totals.push(order.totalMinor);
      period.discountMinor += order.discountMinor;
      period.items += items;
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
        yesterdaySoFar.items += items;
      }
      const at = new Date(order.createdAt);
      if (!days) {
        sold.push({ minute: at.getHours() * 60 + at.getMinutes(), index, totalMinor: order.totalMinor });
        continue;
      }
      // A multi-day period buckets by the day's place in its range, so the comparison's days line up with the period's.
      const hour = days[index].indexOf(storeDay(at));
      if (hour >= days[0].length) continue;
      let bucket = buckets.get(hour);
      if (!bucket) {
        bucket = emptyBucket(hour, 0);
        buckets.set(hour, bucket);
      }
      const hourly = index === 0 ? bucket.today : bucket.yesterday;
      hourly.count++;
      hourly.totalMinor += order.totalMinor;
    }
    period.averageMinor = period.count === 0 ? 0 : Math.round(period.totalMinor / period.count);
    totals.sort((a, b) => a - b);
    const middle = Math.floor(totals.length / 2);
    period.medianMinor = totals.length === 0 ? 0
      : totals.length % 2 ? totals[middle] : Math.round((totals[middle - 1] + totals[middle]) / 2);
    period.largestMinor = totals.length === 0 ? null : totals[totals.length - 1];
    period.taxRates.sort((a, b) => a.ratePpm - b.ratePpm);
    return period;
  });
  yesterdaySoFar.averageMinor = yesterdaySoFar.count === 0 ? 0 : Math.round(yesterdaySoFar.totalMinor / yesterdaySoFar.count);
  const totalMinor = today.totalMinor - yesterdaySoFar.totalMinor;
  const hours: HourBucket[] = [];
  if (days) {
    // One column per day of the period, the days to come empty; v2 aggregateData draws every day, sales or none.
    days[0].forEach((day, hour) => hours.push({ ...buckets.get(hour) ?? emptyBucket(hour, 0), day }));
  } else {
    // v2 getEffectiveDailyRange: the first sale's hour to the end of the last sale's, both days counted; no sale, the whole day.
    const minutes = sold.map(sale => sale.minute);
    const from = minutes.length ? Math.floor(Math.min(...minutes) / 60) * 60 : 0;
    const to = minutes.length ? Math.floor(Math.max(...minutes) / 60) * 60 + 60 : 24 * 60;
    // getNiceMinuteInterval: the smallest nice step that keeps the span to 12 bars.
    const step = NICE_STEPS.find(nice => nice >= (to - from) / 12) ?? NICE_STEPS[NICE_STEPS.length - 1];
    // generateAllDates: whole steps from midnight, the first at or before the span's start.
    for (let minute = Math.floor(from / step) * step; minute < to; minute += step) hours.push(emptyBucket(Math.floor(minute / 60), minute));
    for (const sale of sold) {
      const bucket = hours[Math.floor((sale.minute - hours[0].minute) / step)];
      const side = sale.index === 0 ? bucket.today : bucket.yesterday;
      side.count++;
      side.totalMinor += sale.totalMinor;
    }
  }
  return {
    today, yesterday, yesterdaySoFar,
    delta: {
      totalMinor,
      percentTenths: yesterdaySoFar.totalMinor === 0 ? null : Math.round(totalMinor * 1000 / yesterdaySoFar.totalMinor),
      count: today.count - yesterdaySoFar.count,
      averageMinor: today.averageMinor - yesterdaySoFar.averageMinor,
      items: today.items - yesterdaySoFar.items,
    },
    hours,
  };
}
