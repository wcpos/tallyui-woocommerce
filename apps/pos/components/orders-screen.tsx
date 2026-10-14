import { View } from 'react-native';
import { Button, OrdersList, Text } from '@tallyui/components';
import { useOutbox } from '../lib/sale/outbox-context';

export function OrdersScreen({ onBack }: { onBack(): void }) {
  const outbox = useOutbox();
  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between p-4">
        <Text accessibilityRole="header">Orders</Text>
        <Button testID="orders-back" onPress={onBack}><Text>Back</Text></Button>
      </View>
      {outbox.enabled
        ? <OrdersList orders={outbox.recent} onRetry={ids => outbox.requeue(ids)} stuck={outbox.state.stuck} />
        : <View className="p-4"><Text>Orders show once the store is connected.</Text></View>}
    </View>
  );
}
