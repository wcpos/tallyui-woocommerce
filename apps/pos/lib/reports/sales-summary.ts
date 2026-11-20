import type { Period } from './sales-room';

export type SummaryRow = { key: string; cells: [string, string, string] };
export type SummaryGroup = { key: string; label: string; rows: SummaryRow[]; subtotal: SummaryRow | null };
export type SalesSummary = { head: [string, string, string]; groups: SummaryGroup[]; total: SummaryRow };

/** v2 packages/core/src/screens/main/reports/report/summary.ts; Refunded, Shipping and Registers are omitted because Period has no such data. */
export function salesSummary(period: Period, fmt: { money(minor: number): string; number(n: number): string; cashierName(ref: string): string }): SalesSummary {
  const { money, number, cashierName } = fmt;
  const groups: SummaryGroup[] = [
    { key: 'sales', label: 'Sales', rows: [
      { key: 'orders', cells: ['Orders', number(period.count), ''] },
      { key: 'net', cells: ['Net sales', '', money(period.totalMinor - period.taxMinor)] },
      { key: 'tax', cells: ['Tax', '', money(period.taxMinor)] },
      { key: 'discounts', cells: ['Discounts', '', money(period.discountMinor)] },
    ], subtotal: { key: 'total', cells: ['Total sales', '', money(period.totalMinor)] } },
    { key: 'payments', label: 'Payment Methods',
      rows: period.byMethod.map(row => ({ key: row.method, cells: [row.label, '', money(row.totalMinor)] })),
      subtotal: { key: 'total', cells: ['Taken', '', money(period.byMethod.reduce((sum, row) => sum + row.totalMinor, 0))] } },
  ];
  if (period.taxMinor !== 0) groups.push({ key: 'taxes', label: 'Taxes',
    rows: period.taxRates.map(row => ({ key: String(row.ratePpm), cells: [row.label || 'Tax', '', money(row.taxMinor)] })),
    subtotal: { key: 'total', cells: ['Tax collected', '', money(period.taxRates.reduce((sum, row) => sum + row.taxMinor, 0))] },
  });
  if (period.byCashier.length > 1) groups.push({ key: 'cashiers', label: 'Sales by cashier',
    rows: period.byCashier.map(row => ({ key: row.cashierRef || 'none', cells: [cashierName(row.cashierRef) || 'Unknown', number(row.count), money(row.totalMinor)] })),
    subtotal: { key: 'total', cells: ['Total', number(period.byCashier.reduce((sum, row) => sum + row.count, 0)), money(period.byCashier.reduce((sum, row) => sum + row.totalMinor, 0))] },
  });
  groups.push({ key: 'orders', label: 'Orders', rows: [
    { key: 'items', cells: ['Items sold', number(period.items), ''] },
    { key: 'average', cells: ['Average order', '', money(period.averageMinor)] },
  ], subtotal: null });
  return { head: ['Line', 'Count', 'Amount'], groups,
    total: { key: 'total', cells: ['Total sales', number(period.count), money(period.totalMinor)] } };
}
