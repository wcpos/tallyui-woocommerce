import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Text } from '@tallyui/components';
import { minorUnitDigits } from '@tallyui/core';
import { buildClosureDocument, type Closure, type ClosureContext, type labelKeys } from '@tallyui/pos';

const labels: Record<keyof typeof labelKeys, string> = {
  x_report: 'X report', closure: 'Closure', opened: 'Opened', closed: 'Closed', approver: 'Approver',
  opening_float: 'Opening float', expected: 'Expected', counted: 'Counted', variance: 'Variance',
  tenders: 'Tenders', tender: 'Tender', cash_movements: 'Cash movements', time: 'Time', type: 'Type',
  amount: 'Amount', reason: 'Reason', sales: 'Sales', period_sales: 'Period sales', period_refunds: 'Period refunds',
  transactions: 'Transactions', refunds: 'Refunds', payment_method: 'Payment method', cashiers: 'Cashiers',
  tax_rates: 'Tax rates', tax_rate: 'Tax rate', net: 'Net', tax: 'Tax', gross: 'Gross',
  perpetual_totals: 'Perpetual totals', perpetual_sales: 'Perpetual sales', perpetual_refunds: 'Perpetual refunds',
  unsynced_sales: 'Unsynced sales', short: 'Short', over: 'Over', exact: 'Exact', voided: 'Voided',
  paid_in: 'Paid in', paid_out: 'Paid out', no_sale: 'No sale', void: 'Void', copy: 'Copy',
};

export function ClosurePrint({ closure, storeName, currency, locale = 'en-US' }: {
  closure: Closure; storeName: string; currency: string; locale?: string;
}) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const style = document.createElement('style');
    // The root PortalHost puts the report beside the application and dialog overlays.
    style.textContent = '@media print { [data-print="hide"], :has(> [data-print="closure"]) > :not([data-print="closure"]) { display: none !important } [data-print="closure"] { display: flex !important } }';
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  const exponent = minorUnitDigits(currency);
  const money = new Intl.NumberFormat(locale.replaceAll('_', '-'), {
    style: 'currency', currency, minimumFractionDigits: exponent, maximumFractionDigits: exponent,
  });
  const ctx: ClosureContext = {
    store: { name: storeName }, currency, exponent, locale: locale.replaceAll('_', '-'), timezone: 'device',
    printedAt: new Date().toISOString(), formatMoney: value => value === '' ? '' : money.format(Number(value)), i18n: labels,
  };
  const { closure: report, store, register, order, i18n } = buildClosureDocument(closure, ctx);
  const { breakdowns } = report;
  return (
    <View testID="closure-print-document" dataSet={{ print: 'closure' }} style={{ display: 'none' }} className="gap-2 p-4">
      <Text accessibilityRole="header">{`${String(store.name)} — ${i18n.closure} #${report.number}`}</Text>
      <Text>{`Register: ${String(register.name || register.id)}`}</Text>
      <Text>{`${i18n.opened}: ${report.opened_at.datetime} ${String(breakdowns.labels.opened_by_name)}`}</Text>
      <Text>{`${i18n.closed}: ${report.closed_at.datetime} ${String(breakdowns.labels.closed_by_name)}`}</Text>
      {breakdowns.labels.approved_by_name != null && breakdowns.labels.approved_by_name !== '' && <Text>{`${i18n.approver}: ${String(breakdowns.labels.approved_by_name)}`}</Text>}
      <Text>{`Printed: ${order.printed.datetime}`}</Text>
      <Text>{i18n.opening_float}</Text>
      {(['expected', 'counted', 'variance'] as const).filter(key => breakdowns.opening_float[`${key}_display`] != null && breakdowns.opening_float[`${key}_display`] !== '').map(key => (
        <Text key={key}>{`${i18n[key]}: ${breakdowns.opening_float[`${key}_display`]}`}</Text>
      ))}
      <Text>{i18n.cash_movements}</Text>
      {breakdowns.movements.map(movement => (
        <Text key={movement.id}>{`• ${movement.created_at.datetime} — ${movement.type_label}: ${movement.amount_display} — ${movement.reason}${movement.voided ? ` (${i18n.voided})` : ''}`}</Text>
      ))}
      <Text>{i18n.tenders}</Text>
      {Object.entries(report.till_expected).map(([tender, amount]) => (
        <Text key={tender}>{`Till expected (${tender}): ${ctx.formatMoney(amount)}`}</Text>
      ))}
      {report.tenders.map(tender => (
        <View key={tender.name}>
          <Text>{String(tender.label)}</Text>
          {(['expected', 'counted', 'variance'] as const).filter(key => tender[`${key}_display`] != null && tender[`${key}_display`] !== '').map(key => (
            <Text key={key}>{`${i18n[key]}: ${tender[`${key}_display`]}`}</Text>
          ))}
        </View>
      ))}
      {report.has_sales && <View>
        <Text>{i18n.sales}</Text>
        <Text>{`${i18n.period_sales}: ${report.period_sales_total_display}`}</Text>
        <Text>{`${i18n.period_refunds}: ${report.period_refunds_total_display}`}</Text>
        {breakdowns.transaction_count != null && breakdowns.transaction_count !== '' && <Text>{`${i18n.transactions}: ${String(breakdowns.transaction_count)}`}</Text>}
        {breakdowns.refund_count != null && breakdowns.refund_count !== '' && <Text>{`${i18n.refunds}: ${String(breakdowns.refund_count)}`}</Text>}
        {breakdowns.payment_methods.map((method, index) => <Text key={index}>{`${i18n.payment_method}: ${String(method.name)} — ${i18n.sales}: ${method.sales_display} — ${i18n.refunds}: ${method.refunds_display}`}</Text>)}
        {breakdowns.tax_rates.map((rate, index) => <Text key={index}>{`${i18n.tax_rate}: ${String(rate.name)} — ${i18n.net}: ${rate.net_display} — ${i18n.tax}: ${rate.tax_display} — ${i18n.gross}: ${rate.gross_display}`}</Text>)}
        {breakdowns.cashiers.length > 0 && <Text>{`${i18n.cashiers}: ${breakdowns.cashiers.map(cashier => String(cashier.name)).join(', ')}`}</Text>}
        {report.tax_rounding_note && <Text>{report.tax_rounding_note}</Text>}
      </View>}
      {report.has_perpetual && <View>
        <Text>{i18n.perpetual_totals}</Text>
        <Text>{`${i18n.perpetual_sales}: ${report.perpetual_sales_total_display}`}</Text>
        <Text>{`${i18n.perpetual_refunds}: ${report.perpetual_refunds_total_display}`}</Text>
      </View>}
      <Text>{`${i18n.unsynced_sales}: ${report.unsynced_count} — ${report.unsynced_total_display}`}</Text>
    </View>
  );
}
