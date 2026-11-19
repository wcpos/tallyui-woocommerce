import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Text } from '@tallyui/components';
import { formatClosureDate } from '@tallyui/pos';
import type { SalesTable } from '../lib/reports/sales-tables';

/**
 * A Reports table dialog's printed report (v2 panels/document.ts `buildReportDocument`: the title, the scope, the
 * columns, the rows, the totals and when it was generated), printed the way the Sales summary is.
 */
export function SalesTablePrint({ table, storeName, scope, locale = 'en-US' }: {
  table: SalesTable; storeName: string; scope: string; locale?: string;
}) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const style = document.createElement('style');
    // The root PortalHost puts the report beside the application and dialog overlays.
    style.textContent = '@media print { [data-print="hide"], :has(> [data-print="table"]) > :not([data-print="table"]) { display: none !important } [data-print="table"] { display: flex !important } }';
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  const printed = formatClosureDate(new Date().toISOString(), { timezone: 'device', locale: locale.replaceAll('_', '-') }).datetime;
  return (
    <View testID="sales-table-print" dataSet={{ print: 'table' }} style={{ display: 'none' }} className="gap-2 p-4">
      <Text accessibilityRole="header">{table.title}</Text>
      <Text>{storeName}</Text>
      <Text testID="sales-table-print-scope">{scope}</Text>
      <Text testID="sales-table-print-head">{table.head.join(' — ')}</Text>
      {table.rows.length === 0
        ? <Text testID="sales-table-print-empty">{table.empty}</Text>
        : table.rows.map(row => <Text key={row.key} testID={`sales-table-print-row-${row.key}`}>{row.cells.join(' — ')}</Text>)}
      <Text testID="sales-table-print-total">{table.total.filter(Boolean).join(' — ')}</Text>
      <Text>{table.status}</Text>
      <Text>{`Printed: ${printed}`}</Text>
    </View>
  );
}
