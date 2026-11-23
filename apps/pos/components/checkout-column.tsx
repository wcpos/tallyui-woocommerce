import type { JSX } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import type { useSale } from '@tallyui/pos';
import type { useOfflineLegs } from '../lib/sale/offline-legs';
import type { useTenderCancel } from '../lib/sale/use-tender-cancel';
import { CancelPaymentView } from './cancel-payment-view';
import { CheckoutTitleBar } from './checkout-title-bar';
import { LedgerPane } from './ledger-pane';
import { TenderPane } from './tender-pane';

/**
 * WCPOS v2's checkout column (checkout-column.tsx): the title bar and the tender. Wide, it fills the products column and
 * the ledger is the cart column's; below 900 it fills the cart pane with the app's ledger under the tender.
 */
export function CheckoutColumn({ sale, outbox, multi, wide, cancel, offlineLegs }: {
  sale: ReturnType<typeof useSale>; outbox: boolean; multi: boolean; wide: boolean;
  cancel: ReturnType<typeof useTenderCancel>; offlineLegs: ReturnType<typeof useOfflineLegs>;
}): JSX.Element {
  const { cancelling, voidError, requestCancel, keepPayments, confirmCancel, removeLeg } = cancel;
  const voidLine = voidError ? <Text testID="tender-void-error" accessibilityRole="alert" className="text-destructive">{voidError}</Text> : null;
  const offline = sale.order.payments.filter(payment => offlineLegs.ids.has(payment.id)).length;
  const body = outbox ? (
    // v2's tender pane is a ScrollView (checkout/tender/tender-pane.tsx:377) whose content takes a minimum height, never
    // a height (checkout/LEDGER.md:49), so on a phone a tall pane scrolls to the commit button.
    <ScrollView testID="checkout-scroll" className="flex-1" contentContainerClassName="grow" keyboardShouldPersistTaps="handled">
      {!multi ? <>
        <CheckoutTitleBar disabled={sale.saving} onClose={() => sale.cancelTender()} />
        <TenderPane sale={sale} />
      </> : cancelling && sale.order.payments.length > 0 ? <>
        {voidLine}
        <CancelPaymentView payments={sale.order.payments} currency={sale.order.currency} onKeep={keepPayments} onConfirm={confirmCancel} />
      </> : <>
        <CheckoutTitleBar disabled={sale.saving} onClose={requestCancel}>
          {/* v2's CancelPaymentButton (checkout-body-view.tsx:87-101): outline-destructive (button/index.tsx:53-54), sm beside
              the title when wide, default in the phone sheet (tender-checkout.tsx:129), disabled while the order saves. */}
          {sale.order.payments.length > 0 ? <Button variant="outline" className="border-destructive bg-card" size={wide ? 'sm' : undefined} disabled={sale.saving} testID="checkout-cancel-payment" onPress={requestCancel}><Text>Cancel payment</Text></Button> : null}
        </CheckoutTitleBar>
        {voidLine}
        <TenderPane multi sale={sale} onRecordedOffline={offlineLegs.mark} />
        {/* Wide, the legs are in the cart column's ledger; under the tender only their offline count stays. */}
        {!wide ? <LedgerPane order={sale.order} recordedOffline={offlineLegs.ids} onRemove={sale.saving ? undefined : id => { void removeLeg(id); }} />
          : offline > 0 ? <Text testID="checkout-offline-legs" className="px-2 text-sm text-muted-foreground">{`${offline} ${offline === 1 ? 'payment' : 'payments'} recorded offline`}</Text> : null}
      </>}
    </ScrollView>
  ) : <>
    <Text>Taking payment arrives in the next update</Text>
    <Button onPress={() => sale.cancelTender()}><Text>Back to cart</Text></Button>
  </>;
  // Wide, the column paints the surface the cart pane gave the tender before (`bg-card p-2`).
  return wide ? <View className="flex-1 bg-card p-2">{body}</View> : body;
}
