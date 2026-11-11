import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Dialog, DialogContent, IconButton, Text, XIcon } from '@tallyui/components';
import { formatMoney, type StoreOrder } from '@tallyui/core';
import { wooStatusLabel } from '../lib/orders/order-history';

// v2's status tones (packages/core/src/screens/main/orders/cells/status.tsx:10-21), drawn as
// StatusBadge's dot and word (packages/components/src/status-badge/index.tsx).
type StatusTone = 'ok' | 'info' | 'warning' | 'bad' | 'muted' | 'default';
const STATUS_TONES: Record<string, StatusTone> = {
  completed: 'ok', processing: 'info', 'pos-open': 'info', 'on-hold': 'warning', pending: 'warning',
  'pos-partial': 'warning', failed: 'bad', cancelled: 'muted', refunded: 'muted', trash: 'muted',
};
// v2's tone dots on this theme's tokens: ok -> success, bad -> destructive.
const TONE_DOT: Record<StatusTone, string> = {
  ok: 'bg-success', info: 'bg-info', warning: 'bg-warning', bad: 'bg-destructive', muted: 'bg-muted-foreground', default: 'bg-primary',
};
/** v2's status dot (StatusBadge): a partial refund reads warning, as in orders/edit/view.tsx:89-100. */
export function statusDotClass(status: string, partial = false): string {
  return `h-2 w-2 shrink-0 rounded-full ${TONE_DOT[partial ? 'warning' : STATUS_TONES[status] ?? 'default']}`;
}

// v2's Payment section (orders/view/sections/payment.tsx:36-48). Settled is the store's word,
// isPaidStatus (packages/sync-core/src/woo/moneyCommandAnswer.ts:105-123); a dead order owes nothing.
const UNPAID_STATUSES = ['pos-open', 'pos-partial', 'pending', 'failed', 'cancelled', 'refunded', 'trash'];
const DEAD_STATUSES = ['cancelled', 'failed', 'refunded', 'trash'];
/** v2's Payment section rule: an order with nothing paid that the store does not count as paid, and that is not dead, still owes. */
export function orderPaymentState(order: StoreOrder): { paidMinor: number; remainingMinor: number; owing: boolean } {
  const paidMinor = order.payments.reduce((sum, payment) => sum + payment.amountMinor, 0);
  const remainingMinor = Math.max(0, order.totalMinor - paidMinor);
  const settled = order.status.trim() !== '' && !UNPAID_STATUSES.includes(order.status);
  const dead = DEAD_STATUSES.includes(order.status);
  const owing = order.payments.length === 0 && !settled && !dead && remainingMinor > 0;
  return { paidMinor, remainingMinor, owing };
}

// v2's right side sheet (packages/components/src/dialog/index.tsx:61-78, 198-205): full height, square,
// a left hairline on the card; size xl is w-160, which apps/main/global.css:53 makes 560px.
export const ORDER_SHEET = 'left-auto right-0 top-0 h-full w-full max-w-[560px] translate-x-0 translate-y-0 gap-4 rounded-none border-0 border-l border-border bg-card p-0 py-4';

function formatPlaced(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

// v2's document-style section (packages/core/src/screens/main/orders/view/sections/_section.tsx).
function Section({ title, testID, last, children }: { title: string; testID: string; last?: boolean; children: ReactNode }) {
  return (
    <View testID={testID} className={`px-4 py-4 ${last ? '' : 'border-b border-border'}`}>
      <Text className="mb-3 text-sm font-semibold text-foreground">{title}</Text>
      {children}
    </View>
  );
}

function Row({ testID, label, beside, amount, indent, strong, className }: {
  testID: string; label: string; beside?: ReactNode; amount: string; indent?: boolean; strong?: boolean; className?: string;
}) {
  return (
    <View testID={testID} className={`flex-row items-center justify-between py-1 ${indent ? 'pl-4' : ''} ${className ?? ''}`}>
      <View className="flex-row items-center gap-2">
        <Text className={strong ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{label}</Text>
        {beside}
      </View>
      <Text className={strong ? 'font-semibold text-foreground' : 'text-foreground'}>{amount}</Text>
    </View>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <View className="self-start rounded bg-primary/10 px-1.5 py-0.5">
      <Text className="text-xs font-medium tabular-nums text-primary">{text}</Text>
    </View>
  );
}

/** v2's read-only order modal View tab (orders/edit/view.tsx) for a store order. */
export function OrderDetailView({ order, onReceipt, onClose }: {
  order: StoreOrder; onReceipt(): void; onClose(): void;
}) {
  const gross = (net: number, tax: number) => order.pricesIncludeTax ? net + tax : net;
  const money = (amount: number) => formatMoney({ amount, currency: order.currency }) ?? String(amount);
  const refunded = order.refunds.reduce((sum, refund) => sum + refund.amountMinor, 0);
  const partial = refunded > 0 && refunded < order.totalMinor;
  const statusLabel = partial ? 'Partially refunded' : wooStatusLabel(order.status);
  const payment = orderPaymentState(order);

  const rowCount = order.lines.length + order.fees.length;
  const rowClass = (index: number) => `flex-row items-center gap-3 py-2.5 ${index < rowCount - 1 ? 'border-b border-border' : ''}`;
  const subtotal = order.lines.reduce((sum, line) => sum + gross(line.subtotalMinor, line.subtotalTaxMinor), 0);
  const discount = gross(order.discountMinor, order.discountTaxMinor);
  const shipping = order.shipping.reduce((sum, charge) => sum + gross(charge.totalMinor, charge.taxMinor), 0);
  const fees = order.fees.reduce((sum, fee) => sum + gross(fee.totalMinor, fee.taxMinor), 0);

  return (
    <View className="min-h-0 flex-1 gap-4">
      <View className="flex-row items-center justify-between gap-2 pl-4 pr-1">
        {/* v2's dialog rank (text/ladder.ts l.10 `dialog: 'text-lg font-strong'`), 16 px, with the title's leading-none. */}
        <Text testID="order-modal-title" accessibilityRole="header" className="flex-1 text-lg font-semibold leading-none text-foreground">
          {`Order #${order.reference}`}
        </Text>
        <IconButton testID="order-modal-close" accessibilityLabel="Close" variant="ghost" size="md" onPress={onClose}><XIcon size={18} /></IconButton>
      </View>
      <ScrollView testID="order-modal-view" className="flex-1">
        <View className="gap-2 border-b border-border p-4">
          <View testID="order-modal-status" className="flex-row items-center gap-1.5 self-start">
            <View aria-hidden className={statusDotClass(order.status, partial)} />
            <Text className="shrink text-sm text-foreground">{statusLabel}</Text>
          </View>
          <Text testID="order-modal-identity" className="text-muted-foreground">{formatPlaced(order.placedAt)}</Text>
        </View>

        <Section title="Items" testID="order-modal-items">
          {rowCount === 0
            ? <Text className="text-muted-foreground">No line items.</Text>
            : <>
                <View className="flex-row gap-3 border-b border-border pb-2">
                  <View className="w-8"><Text className="text-xs font-semibold text-muted-foreground">Qty</Text></View>
                  <View className="min-w-0 flex-1"><Text className="text-xs font-semibold text-muted-foreground">Item</Text></View>
                  <View className="w-20 items-end"><Text className="text-xs font-semibold text-muted-foreground">Price</Text></View>
                  <View className="w-20 items-end"><Text className="text-xs font-semibold text-muted-foreground">Total</Text></View>
                </View>
                {order.lines.map((line, index) => {
                  const lineSubtotal = gross(line.subtotalMinor, line.subtotalTaxMinor);
                  const total = gross(line.totalMinor, line.taxMinor);
                  const discounted = lineSubtotal > total;
                  const originalUnit = line.quantity > 0 ? Math.round(lineSubtotal / line.quantity) : 0;
                  const unit = line.quantity > 0 ? Math.round((discounted ? total : lineSubtotal) / line.quantity) : 0;
                  return (
                    <View key={line.id} testID={`order-modal-line-${index}`} className={rowClass(index)}>
                      <View className="w-8"><Text>{line.quantity}</Text></View>
                      <View className="min-w-0 flex-1 gap-0.5">
                        <Text className="font-medium text-foreground">{line.name || '—'}</Text>
                        {line.sku ? <Chip text={line.sku} /> : null}
                      </View>
                      <View className="w-20 items-end">
                        {discounted && (
                          <Text testID={`order-modal-line-${index}-was`} className="text-xs text-muted-foreground line-through">{money(originalUnit)}</Text>
                        )}
                        <Text>{money(unit)}</Text>
                      </View>
                      <View className="w-20 items-end"><Text className="font-medium text-foreground">{money(total)}</Text></View>
                    </View>
                  );
                })}
                {order.fees.map((fee, index) => (
                  <View key={`fee-${index}`} testID={`order-modal-fee-${index}`} className={rowClass(order.lines.length + index)}>
                    <View className="w-8" />
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text className="font-medium text-foreground">{fee.name || 'Fees'}</Text>
                      <Text className="text-xs text-muted-foreground">Fees</Text>
                    </View>
                    <View className="w-20" />
                    <View className="w-20 items-end">
                      <Text className="font-medium text-foreground">{money(gross(fee.totalMinor, fee.taxMinor))}</Text>
                    </View>
                  </View>
                ))}
              </>}
        </Section>

        <Section title="Totals" testID="order-modal-totals">
          <Row testID="order-modal-total-subtotal" label="Subtotal" amount={money(subtotal)} />
          {discount > 0 && (
            <Row testID="order-modal-total-discount" label="Discount" amount={`-${money(discount)}`}
              beside={order.coupons.length > 0 ? <Chip text={order.coupons.map(coupon => coupon.code).join(', ')} /> : undefined} />
          )}
          {order.shipping.length > 0 && (
            <Row testID="order-modal-total-shipping" label="Shipping" amount={money(shipping)}
              beside={<Text className="text-xs text-muted-foreground">{`· ${order.shipping[0].name}`}</Text>} />
          )}
          {fees > 0 && <Row testID="order-modal-total-fees" label="Fees" amount={money(fees)} />}
          {(order.taxMinor > 0 || order.taxLines.length > 0) && (
            <Row testID="order-modal-total-tax" label="Tax" amount={money(order.taxMinor)} />
          )}
          {order.taxLines.map((line, index) => (
            <Row key={`tax-${index}`} testID={`order-modal-total-tax-${index}`} indent amount={money(line.amountMinor)}
              label={line.label ? `${line.label} ${line.ratePpm / 10000}%` : `Tax ${index + 1}`} />
          ))}
          {refunded > 0 && <Row testID="order-modal-total-refund" label="Refund" amount={`-${money(refunded)}`} />}
          <Row testID="order-modal-total-total" strong className="mt-1 border-t border-border pt-2"
            label={refunded > 0 ? 'Net Payment' : 'Total'} amount={money(order.totalMinor - refunded)} />
        </Section>

        {(order.payments.length > 0 || payment.owing || refunded > 0) && (
          <Section title={order.payments.length > 1 ? 'Payments' : 'Payment'} testID="order-modal-payments">
            {order.payments.map((payment, index) => (
              <Row key={`payment-${index}`} testID="order-modal-payment" label={payment.title ?? payment.method} amount={money(payment.amountMinor)} />
            ))}
            {payment.owing && (
              <>
                <Text testID="order-modal-no-payments" className="text-sm text-muted-foreground">No payments yet</Text>
                <View testID="order-modal-ledger" className="pt-2">
                  <Row testID="order-modal-ledger-total" label="Total" amount={money(order.totalMinor)} />
                  <Row testID="order-modal-ledger-paid" label="Paid" amount={money(payment.paidMinor)} />
                  <Row testID="order-modal-ledger-remaining" strong className="mt-1 border-t border-border pt-2" label="Remaining" amount={money(payment.remainingMinor)} />
                </View>
              </>
            )}
            {refunded > 0 && <Row testID="order-modal-payment-refund" className="mt-2" label="Refund" amount={`-${money(refunded)}`} />}
          </Section>
        )}

        <Section title="Customer" testID="order-modal-customer" last>
          <Text className="font-medium text-foreground">{order.customer?.name || 'Guest'}</Text>
          {order.customer?.email ? <Text className="text-xs text-muted-foreground">{order.customer.email}</Text> : null}
        </Section>
      </ScrollView>
      <View testID="order-modal-footer" className="flex-row flex-wrap items-center justify-end gap-2 border-t border-border px-4 pt-4">
        <Button testID="dialog-footer-close" variant="outline" onPress={onClose}><Text>Close</Text></Button>
        <Button testID="order-modal-receipt" variant="outline" onPress={onReceipt}><Text>Receipt</Text></Button>
      </View>
    </View>
  );
}

/** v2's order record dialog (orders/edit/modal.tsx, record-dialog/index.tsx): a right side sheet, View only. */
export function OrderDetailSheet({ order, onReceipt, onClose }: { order: StoreOrder; onReceipt(): void; onClose(): void }) {
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent testID="order-modal" accessibilityLabel={`Order #${order.reference}`} className={ORDER_SHEET}>
        <OrderDetailView order={order} onReceipt={onReceipt} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
