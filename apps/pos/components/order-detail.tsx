import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { Badge, Button, Text } from '@tallyui/components';
import { formatMoney, type StoreOrder } from '@tallyui/core';
import { wooStatusLabel } from '../lib/orders/order-history';

type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive' | 'secondary' | 'outline';

// v2's status tones (packages/core/src/screens/main/orders/cells/status.tsx) mapped onto Badge:
// ok -> success, info -> info, warning -> warning, bad -> destructive, muted -> secondary.
const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  completed: 'success', processing: 'info', 'on-hold': 'warning', pending: 'warning',
  failed: 'destructive', cancelled: 'secondary', refunded: 'secondary', trash: 'secondary',
};

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
      <Text className="text-xs font-medium text-primary">{text}</Text>
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
  const statusVariant: BadgeVariant = partial ? 'warning' : STATUS_VARIANTS[order.status] ?? 'outline';

  const rowCount = order.lines.length + order.fees.length;
  const rowClass = (index: number) => `flex-row items-center gap-3 py-2.5 ${index < rowCount - 1 ? 'border-b border-border' : ''}`;
  const subtotal = order.lines.reduce((sum, line) => sum + gross(line.subtotalMinor, line.subtotalTaxMinor), 0);
  const discount = gross(order.discountMinor, order.discountTaxMinor);
  const shipping = order.shipping.reduce((sum, charge) => sum + gross(charge.totalMinor, charge.taxMinor), 0);
  const fees = order.fees.reduce((sum, fee) => sum + gross(fee.totalMinor, fee.taxMinor), 0);

  return (
    <View testID="order-modal" className="flex-1">
      <ScrollView testID="order-modal-view" className="flex-1 bg-background">
        <View className="gap-2 border-b border-border p-4">
          <Text testID="order-modal-title" accessibilityRole="header" className="text-lg font-semibold text-foreground">
            {`Order #${order.reference}`}
          </Text>
          <View className="flex-row"><Badge testID="order-modal-status" variant={statusVariant} label={statusLabel} /></View>
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

        {order.payments.length > 0 && (
          <Section title={order.payments.length > 1 ? 'Payments' : 'Payment'} testID="order-modal-payments">
            {order.payments.map((payment, index) => (
              <Row key={`payment-${index}`} testID="order-modal-payment" label={payment.title ?? payment.method} amount={money(payment.amountMinor)} />
            ))}
          </Section>
        )}

        <Section title="Customer" testID="order-modal-customer" last>
          <Text className="font-medium text-foreground">{order.customer?.name || 'Guest'}</Text>
          {order.customer?.email ? <Text className="text-xs text-muted-foreground">{order.customer.email}</Text> : null}
        </Section>
      </ScrollView>
      <View className="flex-row justify-end gap-2 border-t border-border p-4">
        <Button testID="order-modal-close" variant="ghost" onPress={onClose}><Text>Close</Text></Button>
        <Button testID="order-modal-receipt" variant="outline" onPress={onReceipt}><Text>Receipt</Text></Button>
      </View>
    </View>
  );
}
