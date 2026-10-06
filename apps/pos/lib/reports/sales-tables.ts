import { orderReference } from '@tallyui/components';
import type { PosOrder } from '@tallyui/pos';
import type { Period } from './sales-room';
import { dayRange } from './today-sales';

export type SalesTable = {
  title: string;
  head: string[];
  align: ('left' | 'right')[];
  rows: { key: string; cells: string[] }[];
  total: string[];
  status: string;
};

export function paymentsTable(period: Period, money: (minor: number) => string | undefined): SalesTable {
  const format = (minor: number) => money(minor) ?? '';
  return {
    title: 'Sales by payment method',
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

export function taxesTable(period: Period, money: (minor: number) => string | undefined): SalesTable {
  const format = (minor: number) => money(minor) ?? '';
  return {
    title: 'Taxes collected',
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
  options: { now: Date; currency: string; money: (minor: number) => string | undefined },
): SalesTable {
  const { now, currency, money } = options;
  const format = (minor: number) => money(minor) ?? '';
  const { startIso, endIso } = dayRange(now);
  const today = orders.filter(order => order.currency === currency && order.createdAt >= startIso && order.createdAt < endIso)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  const sum = today.reduce((total, order) => total + order.totalMinor, 0);
  return {
    title: 'Orders',
    head: ['Order', 'Time', 'Paid by', 'Total'],
    align: ['left', 'left', 'left', 'right'],
    rows: today.map(order => {
      const date = new Date(order.createdAt);
      const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      const paidBy = [...new Set(order.payments.map(payment => payment.method))]
        .map(method => method === 'cash' ? 'Cash' : 'Card terminal').join(' + ');
      return { key: order.id, cells: [orderReference(order), time, paidBy, format(order.totalMinor)] };
    }),
    total: ['Total', '', '', format(sum)],
    status: `${today.length} ${today.length === 1 ? 'order' : 'orders'} · ${format(sum)}`,
  };
}
