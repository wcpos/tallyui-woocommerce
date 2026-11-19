import { minorUnitDigits } from '@tallyui/core';
import { exportCsv, type Closure } from '@tallyui/pos';
import { cashierNameFor, type CashierName } from '../auth/cashier-name';

const labels: Record<string, string> = {
  'reports.csv_business_day': 'Business day',
  'reports.csv_closure': 'Closure',
  'reports.csv_register': 'Register',
  'reports.csv_store': 'Store',
  'reports.csv_opened': 'Opened',
  'reports.csv_closed': 'Closed',
  'reports.csv_closer': 'Closer',
  'reports.csv_status': 'Status',
  'reports.document.expected': 'Expected',
  'register.counted': 'Counted',
  'register.variance': 'Variance',
  'register.short': 'Short',
  'register.over': 'Over',
  'register.unsynced': 'Unsynced',
  'register.unknown_cashier': 'Unknown cashier',
  'reports.exact': 'Exact',
  'reports.corrected': 'Corrected',
};

export function closuresCsv(closures: readonly Closure[], currency: string, cashiers: readonly CashierName[], storeName: string): string {
  // v2 export-csv.ts:55 writes the stamped closed_by_name; a closure without one names its closer as the closures list does.
  const rows = closures.map(row => row.breakdowns.closed_by_name || !row.closed_by ? row
    : { ...row, breakdowns: { ...row.breakdowns, closed_by_name: cashierNameFor(cashiers, row.closed_by) } });
  // `names` is exportCsv's register-name map (v2 export-csv.ts:52), not a cashier map.
  return exportCsv(rows, minorUnitDigits(currency), key => labels[key] ?? key, {}, storeName);
}
