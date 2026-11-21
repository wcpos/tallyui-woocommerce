import type { JSX } from 'react';
import { View } from 'react-native';
import { IconButton, Text, XIcon } from '@tallyui/components';
import { useFormatMoney } from '@tallyui/core';
import type { PosOrder, PosOrderPayment } from '@tallyui/pos';
import { CheckIcon, ClockIcon } from './icons';

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
  const formatMoney = useFormatMoney();
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
      {/* v2 lifts the X above the banner that follows it (receipt-stage.tsx:262, z-10), or the banner takes its click. */}
      <IconButton testID="receipt-close" accessibilityLabel="Close" variant="ghost" size="sm"
        className="absolute top-2 right-2 z-10" onPress={onClose}><XIcon size={18} /></IconButton>
      <View testID="receipt-paid-banner" className="items-center gap-3 p-4">
        <View testID="receipt-paid-disc" dataSet={{ tone: awaiting ? 'warning' : 'ok' }}
          accessibilityLabel={awaiting ? 'Awaiting store' : 'Paid'}
          className={`size-24 rounded-full items-center justify-center ${awaiting ? 'bg-warning-bg' : 'bg-ok-bg'}`}>
          {/* v2's ToneDisc size="lg" (tone-disc/index.tsx:9-14): a 96px soft wash, the glyph at 36px in the tone's ink. */}
          {awaiting
            ? <ClockIcon testID="receipt-paid-glyph" size={36} className="text-warning-text" />
            : <CheckIcon testID="receipt-paid-glyph" size={36} className="text-success" />}
        </View>
        {/* v2's AmountFigure hero (amount-figure/index.tsx:18-24): text-amt 40px, line 1.1 (global.css:44, :203), bold, tabular. */}
        <View testID="checkout-paid-headline" className="items-center gap-1">
          {changeDue
            ? <Text testID="receipt-change-due" className="text-[40px] leading-[44px] font-bold tabular-nums text-center">{`Change ${money(figures.changeMinor)}`}</Text>
            : <Text className="text-[40px] leading-[44px] font-bold tabular-nums text-center">{`Paid ${money(figures.paidMinor)}`}</Text>}
          <Text testID="receipt-paid-with" className="text-muted-foreground text-center">
            {awaiting ? <Text testID="receipt-awaiting-store" className="text-warning-text">Awaiting store · </Text> : null}
            {subLine}
          </Text>
        </View>
      </View>
    </View>
  );
}
