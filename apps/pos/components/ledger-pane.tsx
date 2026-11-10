import type { JSX } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@tallyui/components';
import { formatMoney } from '@tallyui/core';
import type { useSale } from '@tallyui/pos';

/** WCPOS v2's checkout ledger: the balance, each local leg taken so far, and (closing) Total / Paid / Remaining. */
export function LedgerPane({ order, onRemove, closing = false }: {
  order: ReturnType<typeof useSale>['order'];
  /** When given, each leg has a Remove button that calls it with the payment id; when absent, no Remove buttons. */
  onRemove?: (paymentId: string) => void;
  /** Adds the Total / Paid / Remaining block: the wide layout's pane. */
  closing?: boolean;
}): JSX.Element {
  const fmt = (amount: number) => formatMoney({ amount, currency: order.currency }) ?? '';
  const partPaid = order.payments.length > 0 && order.balanceDueMinor > 0;
  const row = (label: string, id: string, amount: number) => <View className="flex-row justify-between">
    <Text className="text-muted-foreground">{label}</Text>
    <Text testID={id} className="tabular-nums text-foreground">{fmt(amount)}</Text>
  </View>;

  return <View testID="checkout-ledger-pane" className="gap-4">
    <View className="gap-1">
      <Text testID="checkout-ledger-eyebrow" className="text-sm text-muted-foreground">{partPaid ? 'Remaining' : 'Total'}</Text>
      <Text testID="checkout-ledger-balance" className="text-3xl font-semibold tabular-nums text-foreground">
        {fmt(partPaid ? order.balanceDueMinor : order.totalMinor)}
      </Text>
      {partPaid ? <Text testID="checkout-ledger-paid-of" className="text-sm text-muted-foreground">
        {`${fmt(order.paidMinor)} of ${fmt(order.totalMinor)} paid`}
      </Text> : null}
    </View>
    <View testID="checkout-ledger" className="gap-2">
      {order.payments.length === 0 ? <Text testID="checkout-ledger-empty" className="text-muted-foreground">No payments yet</Text>
        : order.payments.map(p => <View key={p.id} testID={`checkout-leg-${p.id}`} className="flex-row items-center gap-2 border-b border-border py-2">
          <View className="flex-1 gap-1">
            <Text className="text-foreground">{p.method === 'cash' ? 'Cash' : 'Card'}</Text>
            {p.reference ? <Text className="text-sm text-muted-foreground">{p.reference}</Text> : null}
          </View>
          <Text className="tabular-nums text-foreground">{fmt(p.amountMinor)}</Text>
          {onRemove ? <Pressable testID={`checkout-remove-leg-${p.id}`} accessibilityRole="button" accessibilityLabel="Remove tender"
            onPress={() => onRemove(p.id)} className="rounded-md border border-border bg-card px-3 py-2">
            <Text className="text-foreground">Remove</Text>
          </Pressable> : null}
        </View>)}
    </View>
    {order.balanceDueMinor === 0 && order.payments.length > 0
      ? <Text testID="checkout-ledger-paid-in-full" className="font-semibold text-foreground">Paid in full</Text> : null}
    {closing ? <View testID="checkout-ledger-totals" className="gap-1 border-t border-border pt-2">
      {row('Total', 'checkout-order-total', order.totalMinor)}
      {row('Paid', 'checkout-ledger-paid', order.paidMinor)}
      {order.balanceDueMinor > 0 ? row('Remaining', 'checkout-ledger-remaining', order.balanceDueMinor) : null}
      {order.changeDueMinor > 0 ? row('Change', 'checkout-ledger-change', order.changeDueMinor) : null}
    </View> : null}
  </View>;
}
