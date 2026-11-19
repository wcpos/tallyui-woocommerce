import type { JSX } from 'react';
import { Pressable, View } from 'react-native';
import { Badge, Text } from '@tallyui/components';
import { formatMoney } from '@tallyui/core';
import type { Payment, useSale } from '@tallyui/pos';
import { cashLegFigures } from '../lib/sale/cash-leg-figures';

// v2 `statusLabel` / `statusVariant` (checkout/tender/labels.ts:6-28): a captured cash leg reads Paid; no status is captured.
const STATUS_LABEL = { pending: 'Pending', authorized: 'Authorized', captured: 'Captured', failed: 'Failed', voided: 'Voided' };
// The tinted badge of closure-list.tsx's ToneBadge, in v2's ok / bad / info tones.
const TONE = { ok: ['success', 'bg-success/15'], bad: ['destructive', 'bg-destructive/15'], info: ['info', 'bg-info/15'] } as const;
const settled = (p: Payment) => !p.status || p.status === 'captured' || p.status === 'authorized';
function LegStatus({ payment: p }: { payment: Payment }): JSX.Element {
  const status = p.status ?? 'captured';
  const [variant, tint] = TONE[settled(p) ? 'ok' : status === 'failed' ? 'bad' : 'info'];
  return <Badge testID={`checkout-status-leg-${p.id}`} variant={variant} className={`h-6 min-w-6 justify-center self-start px-2 py-0 ${tint}`}>
    <Text className="text-sm font-bold tabular-nums text-foreground">{status === 'captured' && p.method === 'cash' ? 'Paid' : STATUS_LABEL[status]}</Text>
  </Badge>;
}

/** WCPOS v2's checkout ledger: the balance, each local leg taken so far, and (closing) Total / Paid / Remaining. */
export function LedgerPane({ order, onRemove, closing = false, recordedOffline }: {
  order: ReturnType<typeof useSale>['order'];
  /** The ids of the legs taken offline: each gets v2's "Recorded offline" help line (ledger-pane.tsx:287-293). */
  recordedOffline?: ReadonlySet<string>;
  /** When given, each leg has a Remove button that calls it with the payment id; when absent, no Remove buttons. */
  onRemove?: (paymentId: string) => void;
  /** Adds the Total / Paid / Remaining block: the wide layout's pane. */
  closing?: boolean;
}): JSX.Element {
  const fmt = (amount: number) => formatMoney({ amount, currency: order.currency }) ?? '';
  const partPaid = order.payments.length > 0 && order.balanceDueMinor > 0;
  // v2: a zero balance with nothing settled (every leg failed or voided) is not paid.
  const paidInFull = order.balanceDueMinor === 0 && order.payments.some(settled);
  // v2 (ledger-pane.tsx:196, :259): each leg and Paid read the applied amounts, the change taken out of the cash legs.
  const figures = cashLegFigures(order.payments, order.changeDueMinor);
  const paid = order.paidMinor - order.changeDueMinor;
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
        {`${fmt(paid)} of ${fmt(order.totalMinor)} paid`}
      </Text> : null}
    </View>
    <View testID="checkout-ledger" className="gap-2">
      {order.payments.length === 0 ? <Text testID="checkout-ledger-empty" className="text-muted-foreground">No payments yet</Text>
        : order.payments.map(leg => ({ ...leg, ...figures.get(leg.id) })).map(p => <View key={p.id} testID={`checkout-leg-${p.id}`} className="flex-row items-center gap-2 border-b border-border py-2">
          <View className="flex-1 gap-1">
            <Text className="text-foreground">{p.method === 'cash' ? 'Cash' : 'Card'}</Text>
            {p.reference ? <Text className="text-sm text-muted-foreground">{p.reference}</Text> : null}
            {p.method === 'cash' && p.tenderedMinor ? <Text testID={`checkout-tendered-leg-${p.id}`} className="text-sm text-muted-foreground">
              {`Tendered ${fmt(p.tenderedMinor)} · change ${fmt(p.changeMinor ?? 0)}`}</Text> : null}
            {recordedOffline?.has(p.id) ? <Text testID={`checkout-offline-leg-${p.id}`} className="text-sm text-muted-foreground">Recorded offline</Text> : null}
          </View>
          <Text className="tabular-nums text-foreground">{fmt(p.amountMinor)}</Text>
          <LegStatus payment={p} />
          {onRemove ? <Pressable testID={`checkout-remove-leg-${p.id}`} accessibilityRole="button" accessibilityLabel="Remove tender"
            onPress={() => onRemove(p.id)} className="rounded-md border border-border bg-card px-3 py-2">
            <Text className="text-foreground">Remove</Text>
          </Pressable> : null}
        </View>)}
      {paidInFull && !closing ? <Text testID="checkout-ledger-paid-in-full" className="text-sm text-success">Paid in full</Text> : null}
    </View>
    {closing ? <View testID="checkout-ledger-totals" className="gap-1 border-t border-border pt-2">
      {row('Total', 'checkout-order-total', order.totalMinor)}
      {row('Paid', 'checkout-ledger-paid', paid)}
      {paidInFull ? <Text testID="checkout-ledger-paid-in-full" className="font-semibold text-success">Paid in full</Text>
        : order.balanceDueMinor > 0 ? row('Remaining', 'checkout-ledger-remaining', order.balanceDueMinor) : null}
      {order.changeDueMinor > 0 ? row('Change', 'checkout-ledger-change', order.changeDueMinor) : null}
    </View> : null}
  </View>;
}
