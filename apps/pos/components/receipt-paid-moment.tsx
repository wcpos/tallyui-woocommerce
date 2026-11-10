import type { JSX } from 'react';
import { View } from 'react-native';
import { IconButton, Text, XIcon } from '@tallyui/components';
import { formatMoney } from '@tallyui/core';
import type { PosOrder, PosOrderPayment } from '@tallyui/pos';

// The method labels the reports and TallyUI's Receipt use.
const METHOD_LABELS: Record<PosOrderPayment['method'], string> = { cash: 'Cash', external: 'Card terminal' };

export interface PaidMomentFigures { paidMinor: number; changeMinor: number; cashTenderedMinor: number; methods: string[]; paymentCount: number }

// A cash row's amountMinor already has the change taken off; tenderedMinor is what the customer handed over.
export function paidMomentFigures(payments: readonly PosOrderPayment[]): PaidMomentFigures {
  const methods: string[] = [];
  let paidMinor = 0, changeMinor = 0, cashTenderedMinor = 0;
  for (const payment of payments) {
    paidMinor += payment.amountMinor;
    changeMinor += payment.changeMinor ?? 0;
    if (payment.method === 'cash') cashTenderedMinor += payment.tenderedMinor ?? payment.amountMinor;
    const label = METHOD_LABELS[payment.method];
    if (!methods.includes(label)) methods.push(label);
  }
  return { paidMinor, changeMinor, cashTenderedMinor, methods, paymentCount: payments.length };
}

// v2's PaidMoment (checkout/receipt-stage/receipt-stage.tsx): the tick, the headline, what paid, and whether the store has the sale.
export function ReceiptPaidMoment({ posOrder, locale, onClose }: {
  posOrder: Pick<PosOrder, 'payments' | 'currency' | 'syncStatus'>; locale?: string; onClose(): void;
}): JSX.Element {
  const money = (minor: number) => formatMoney({ amount: minor, currency: posOrder.currency }, locale) ?? String(minor);
  const figures = paidMomentFigures(posOrder.payments);
  // v2's useAwaitsStore: the store has not heard the sale (ADR 0040), whatever the online state. A refused sale is not awaiting.
  const awaiting = posOrder.syncStatus === 'pending';
  const changeDue = figures.changeMinor > 0;
  const hasCash = posOrder.payments.some(payment => payment.method === 'cash');
  const base = changeDue && hasCash
    ? `Paid ${money(figures.paidMinor)} · tendered ${money(figures.cashTenderedMinor)} in cash`
    : figures.methods.join(' + ');
  const subLine = figures.paymentCount > 1 ? `${base} · ${figures.paymentCount} payments` : base;
  return (
    <View testID="checkout-paid" className="relative">
      <IconButton testID="receipt-close" accessibilityLabel="Close" variant="ghost" size="sm"
        className="absolute top-2 right-2" onPress={onClose}><XIcon size={18} /></IconButton>
      <View testID="receipt-paid-banner" className="items-center gap-3 p-4">
        <View testID="receipt-paid-disc" dataSet={{ tone: awaiting ? 'warning' : 'ok' }}
          accessibilityLabel={awaiting ? 'Awaiting store' : 'Paid'}
          className={`size-12 rounded-full items-center justify-center ${awaiting ? 'bg-warning' : 'bg-success'}`}>
          <Text className={`text-xl ${awaiting ? 'text-warning-foreground' : 'text-success-foreground'}`}>{awaiting ? '…' : '✓'}</Text>
        </View>
        <View testID="checkout-paid-headline" className="items-center gap-1">
          {changeDue
            ? <Text testID="receipt-change-due" className="text-2xl font-semibold">{`Change ${money(figures.changeMinor)}`}</Text>
            : <Text className="text-2xl font-semibold">{`Paid ${money(figures.paidMinor)}`}</Text>}
          <Text testID="receipt-paid-with" className="text-muted-foreground text-center">
            {awaiting ? <Text testID="receipt-awaiting-store" className="text-warning">Awaiting store · </Text> : null}
            {subLine}
          </Text>
        </View>
      </View>
    </View>
  );
}
