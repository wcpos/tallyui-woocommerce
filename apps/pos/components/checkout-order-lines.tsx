import type { JSX } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '@tallyui/components';
import type { useSale } from '@tallyui/pos';
import { useFormatStoreMoney } from '../lib/money/store-money';

/**
 * The stilled order beside the tender: v2's stilled cart (stilled-cart.tsx), drawn read-only. One row per line item, in
 * the cart-pane's row rhythm (`px-2 py-2`, a hairline between rows), with the line total the cart shows.
 */
export function CheckoutOrderLines({ order }: { order: ReturnType<typeof useSale>['order'] }): JSX.Element {
  const formatMoney = useFormatStoreMoney();
  const total = (lineId: string) => order.display.lines.find(line => line.lineId === lineId)?.amountMinor ?? 0;
  return <ScrollView testID="checkout-order-lines" className="min-h-0 flex-1">
    {order.lineItems.map((line, index) => <View key={line.id} testID={`checkout-order-line-${line.id}`}
      className={`flex-row items-center gap-2 px-2 py-2${index > 0 ? ' border-t border-border' : ''}`}>
      <Text className="flex-1 text-foreground" numberOfLines={2}>{line.name}</Text>
      {line.quantity !== 1 ? <Text className="tabular-nums text-muted-foreground">{`× ${line.quantity}`}</Text> : null}
      <Text className="text-right font-semibold tabular-nums text-foreground">{formatMoney({ amount: total(line.id), currency: order.currency }) ?? ''}</Text>
    </View>)}
  </ScrollView>;
}
