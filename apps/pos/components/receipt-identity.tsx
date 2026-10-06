import { View } from 'react-native';
import { Text } from '@tallyui/components';
import type { ReceiptIdentity as Identity } from '../lib/receipts/receipt-identity';

export function ReceiptIdentity({ identity }: { identity: Identity }) {
  return (
    <View testID="receipt-identity" className="w-full max-w-md self-center bg-card px-4 pb-4">
      <Text>Sales receipt</Text>
      <Text>{`Register: ${identity.register.name}`}</Text>
      <Text>{`${identity.software.name} ${identity.software.app_version}`}</Text>
    </View>
  );
}
