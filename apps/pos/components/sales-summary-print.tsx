import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Text } from '@tallyui/components';
import { formatClosureDate } from '@tallyui/pos';
import type { Period } from '../lib/reports/sales-room';

/** The Reports screen's printed sales summary (v2 `HeroPrint`), printed the way the closure reprint is. */
export function SalesSummaryPrint({ storeName, scope, date, period, money, locale = 'en-US' }: {
  storeName: string; scope: string; date: string; period: Period; money(minor: number): string; locale?: string;
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
  return (
    <View testID="sales-summary-print" dataSet={{ print: 'summary' }} style={{ display: 'none' }} className="gap-2 p-4">
      <Text accessibilityRole="header">Sales summary</Text>
      <Text>{storeName}</Text>
      <Text testID="sales-summary-scope">{scope}</Text>
      <Text>{date}</Text>
      <Text testID="sales-summary-total">{`Total sales: ${money(period.totalMinor)}`}</Text>
      <Text testID="sales-summary-orders">{`Orders: ${period.count}`}</Text>
      <Text>{`Average order: ${money(period.averageMinor)}`}</Text>
      <Text>{`Items: ${period.items}`}</Text>
      <Text>{`Discounts: ${money(period.discountMinor)}`}</Text>
      <Text>{`Tax: ${money(period.taxMinor)}`}</Text>
      <View testID="sales-summary-payments">
        <Text>Payments</Text>
        {period.byMethod.map(row => (
          <Text key={row.method} testID={`sales-summary-payment-${row.method}`}>{`${row.label} — ${row.count} — ${money(row.totalMinor)}`}</Text>
        ))}
      </View>
      {period.taxMinor !== 0 && <View testID="sales-summary-taxes">
        <Text>Taxes</Text>
        {period.taxRates.map(row => (
          <Text key={row.ratePpm}>{`${row.label} — Net ${money(row.netMinor)} — Tax ${money(row.taxMinor)} — Gross ${money(row.grossMinor)}`}</Text>
        ))}
      </View>}
      <Text>{`Printed: ${printed}`}</Text>
    </View>
  );
}
