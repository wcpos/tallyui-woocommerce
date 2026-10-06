import { minorUnitDigits } from '@tallyui/core';
import { exportCsv, type Closure } from '@tallyui/pos';
import type { AuthTokens } from '../auth/login';

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

export function closuresCsv(closures: readonly Closure[], currency: string, user: AuthTokens['user'] | undefined, storeName: string): string {
  const names = user ? { [String(user.id)]: user.displayName } : {};
  return exportCsv(closures, minorUnitDigits(currency), key => labels[key] ?? key, names, storeName);
}
