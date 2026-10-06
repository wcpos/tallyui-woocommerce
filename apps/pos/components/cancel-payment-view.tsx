import type { JSX } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import { formatMoney } from '@tallyui/core';

export interface CancelPaymentViewProps {
  payments: ReadonlyArray<{ id: string; method: string; amountMinor: number }>;
  currency: string;
  onKeep: () => void;
  onConfirm: () => void;
}

// Cancelling mid-split is a physical act first: cash taken has to go back out of the drawer (v2 CancelPaymentView).
export function CancelPaymentView(props: CancelPaymentViewProps): JSX.Element {
  const { payments, currency, onKeep, onConfirm } = props;
  return (
    <View testID="cancel-payment" className="gap-4 p-4" dataSet={{ print: 'hide' }}>
      <Text className="text-lg font-semibold">Cancel this payment?</Text>
      <Text className="text-sm text-muted-foreground">Money already taken has to go back to the customer:</Text>
      {payments.map(payment => {
        const money = formatMoney({ amount: payment.amountMinor, currency });
        const label = payment.method === 'external' ? 'Card' : payment.method.charAt(0).toUpperCase() + payment.method.slice(1);
        return <Text key={payment.id} testID={`checkout-cancel-leg-${payment.id}`} className="rounded-md border border-border p-2 text-sm">
          {payment.method === 'cash' ? `Return ${money} cash to the customer` : `Void ${money} on ${label}`}
        </Text>;
      })}
      <View className="flex-row justify-end gap-2">
        <Button variant="outline" testID="checkout-cancel-keep-going" onPress={onKeep}><Text>Keep taking payment</Text></Button>
        <Button variant="destructive" testID="checkout-cancel-confirm" onPress={onConfirm}><Text>Cancel and void</Text></Button>
      </View>
    </View>
  );
}
