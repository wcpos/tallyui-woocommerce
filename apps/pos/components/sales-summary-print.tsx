import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Text } from '@tallyui/components';
import { formatClosureDate } from '@tallyui/pos';
import type { Period } from '../lib/reports/sales-room';
import { salesSummary } from '../lib/reports/sales-summary';

/** The Reports screen's printed sales summary (v2 `HeroPrint`), printed the way the closure reprint is. */
export function SalesSummaryPrint({ storeName, scope, date, period, money, cashierName, locale = 'en-US' }: {
  storeName: string; scope: string; date: string; period: Period; money(minor: number): string; cashierName(ref: string): string; locale?: string;
}) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const style = document.createElement('style');
    // The root PortalHost puts the summary beside the application and dialog overlays.
    style.textContent = '@media print { [data-print="hide"], :has(> [data-print="summary"]) > :not([data-print="summary"]) { display: none !important } [data-print="summary"] { display: flex !important } }';
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  const printed = formatClosureDate(new Date().toISOString(), { timezone: 'device', locale: locale.replaceAll('_', '-') }).datetime;
  const number = (n: number) => new Intl.NumberFormat(locale.replaceAll('_', '-')).format(n);
  const summary = salesSummary(period, { money, number, cashierName });
  return (
    <View testID="sales-summary-print" dataSet={{ print: 'summary' }} style={{ display: 'none' }} className="gap-2 p-4">
      <Text accessibilityRole="header">Sales summary</Text>
      <Text>{storeName}</Text>
      <Text testID="sales-summary-scope">{scope}</Text>
      <Text>{date}</Text>
      <Text testID="sales-summary-head">{summary.head.join(' — ')}</Text>
      {summary.groups.map(group => (
        <View key={group.key} testID={`sales-summary-group-${group.key}`}>
          <Text testID={`sales-summary-group-${group.key}-label`}>{group.label}</Text>
          {group.rows.map(row => (
            <Text key={row.key} testID={`sales-summary-${group.key}-row-${row.key}`}>{row.cells.filter(cell => cell !== '').join(' — ')}</Text>
          ))}
          {group.subtotal && <Text testID={`sales-summary-${group.key}-subtotal`}>{group.subtotal.cells.filter(cell => cell !== '').join(' — ')}</Text>}
        </View>
      ))}
      <Text testID="sales-summary-total">{summary.total.cells.filter(cell => cell !== '').join(' — ')}</Text>
      <Text>{`Printed: ${printed}`}</Text>
    </View>
  );
}
