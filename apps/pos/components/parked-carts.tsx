import type { JSX } from 'react';
import { ScrollView, View } from 'react-native';
import { formatMoney } from '@tallyui/core';
import { Button, Text } from '@tallyui/components';
import type { ParkedCart } from '../lib/sale/parked-carts';

export function ParkedCartsList({ carts, currency, onOpen, onDelete, onClose }: {
  carts: ParkedCart[]; currency: string; onOpen(id: string): void; onDelete(id: string): void; onClose(): void;
}): JSX.Element {
  return (
    <ScrollView>
      <Text>Parked carts</Text>
      {carts.length === 0 ? <Text>No parked carts</Text> : carts.map(cart => (
        <View key={cart.id} className="gap-2 py-2">
          <Text>{`${cart.itemCount} items · ${formatMoney({ amount: cart.totalMinor, currency })}`}</Text>
          <Text>{new Date(cart.parkedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Text>
          <Button onPress={() => onOpen(cart.id)}><Text>Open</Text></Button>
          <Button onPress={() => onDelete(cart.id)}><Text>Delete</Text></Button>
        </View>
      ))}
      <Button onPress={onClose}><Text>Close</Text></Button>
    </ScrollView>
  );
}
