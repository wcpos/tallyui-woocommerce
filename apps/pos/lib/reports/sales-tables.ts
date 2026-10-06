import type { Period } from './sales-room';

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
