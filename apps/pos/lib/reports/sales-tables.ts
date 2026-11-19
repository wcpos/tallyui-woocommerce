import { orderReference } from '@tallyui/components';
import type { DayRange, PosOrder } from '@tallyui/pos';
import { rangeBounds, type Period } from './sales-room';

export type SalesTable = {
  title: string;
  head: string[];
  align: ('left' | 'right')[];
  rows: { key: string; cells: string[] }[];
  total: string[];
  status: string;
  /** The empty line, from v2: orders-panel.tsx:86, cards/payments.tsx:44, cards/where-sold.tsx:80 (taxes has none, so the generic one). */
  empty: string;
};

export function paymentsTable(period: Period, money: (minor: number) => string | undefined): SalesTable {
  const format = (minor: number) => money(minor) ?? '';
  return {
    title: 'Sales by payment method',
    empty: 'No payments in this period',
    head: ['Method', 'Orders', 'Amount', 'Share'],
    align: ['left', 'right', 'right', 'right'],
    rows: [...period.byMethod].sort((a, b) => b.totalMinor - a.totalMinor || a.label.localeCompare(b.label)).map(row => ({
      key: row.method,
      cells: [row.label, String(row.count), format(row.totalMinor), period.totalMinor === 0
        ? '—' : `${(Math.round(row.totalMinor * 1000 / period.totalMinor) / 10).toFixed(1)}%`],
    })),
    total: ['Total', String(period.count), format(period.totalMinor), ''],
    status: `${period.count} ${period.count === 1 ? 'order' : 'orders'} · ${format(period.totalMinor)}`,
  };
}

// v2 panels/specs.ts:293-334 channels view: every Tally sale is in store.
export function whereSoldTable(period: Period, money: (minor: number) => string | undefined): SalesTable {
  const format = (minor: number) => money(minor) ?? '';
  const share = period.totalMinor === 0 ? '—' : '100.0%';
  return {
    title: 'Channels',
    empty: 'No sales in this period',
    head: ['Channel', 'Orders', 'Amount', 'Share'],
    align: ['left', 'right', 'right', 'right'],
    rows: period.count === 0 ? [] : [{
      key: 'store', cells: ['In store', String(period.count), format(period.totalMinor), share],
    }],
    total: ['Total', String(period.count), format(period.totalMinor), period.count === 0 ? '' : share],
    status: `${period.count} ${period.count === 1 ? 'order' : 'orders'} · ${format(period.totalMinor)}`,
  };
}

export function taxesTable(period: Period, money: (minor: number) => string | undefined): SalesTable {
  const format = (minor: number) => money(minor) ?? '';
  return {
    title: 'Taxes collected',
    empty: 'No sales in this period',
    head: ['Rate', 'Net', 'Tax', 'Gross'],
    align: ['left', 'right', 'right', 'right'],
    rows: [...period.taxRates].sort((a, b) => a.ratePpm - b.ratePpm).map(row => ({
      key: String(row.ratePpm),
      cells: [row.label, format(row.netMinor), format(row.taxMinor), format(row.grossMinor)],
    })),
    total: ['Total', format(period.totalMinor - period.taxMinor), format(period.taxMinor), format(period.totalMinor)],
    status: `${period.count} ${period.count === 1 ? 'order' : 'orders'} · ${format(period.totalMinor)}`,
  };
}

export function ordersTable(
  orders: readonly PosOrder[],
  options: { range: DayRange; currency: string; money: (minor: number) => string | undefined; leftOut?: ReadonlySet<string> },
): SalesTable {
  const { range, currency, money, leftOut = new Set<string>() } = options;
  const format = (minor: number) => money(minor) ?? '';
  const { startIso, endIso } = rangeBounds(range);
  const today = orders.filter(order => order.currency === currency && order.createdAt >= startIso && order.createdAt < endIso)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  // v2 panels/specs.ts:188-222: every order in range is a row with a Counted Yes/No; the footer sums the counted ones.
  const counted = today.filter(order => !leftOut.has(order.id));
  const sum = counted.reduce((total, order) => total + order.totalMinor, 0);
  return {
    title: 'Orders',
    empty: 'No orders in this period',
    head: ['Order', 'Time', 'Paid by', 'Total', 'Counted'],
    align: ['left', 'left', 'left', 'right', 'left'],
    rows: today.map(order => {
      const date = new Date(order.createdAt);
      const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      const paidBy = [...new Set(order.payments.map(payment => payment.method))]
        .map(method => method === 'cash' ? 'Cash' : 'Card terminal').join(' + ');
      return { key: order.id, cells: [orderReference(order), time, paidBy, format(order.totalMinor), leftOut.has(order.id) ? 'No' : 'Yes'] };
    }),
    total: ['Counted', '', '', format(sum), ''],
    // v2 panel.tsx:254-259 `reports.orders_counted`, and `reports.orders_counted_left_out` when any is left out.
    status: `${counted.length} of ${today.length} counted${counted.length < today.length ? ' · the numbers follow' : ''}`,
  };
}
