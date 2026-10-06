import { View } from 'react-native';
import { Text } from '@tallyui/components';
import type { ReceiptIdentity as Identity } from '../lib/receipts/receipt-identity';

export function ReceiptIdentity({ identity }: { identity: Identity }) {
  return (
    <View testID="receipt-identity" className="w-full max-w-md self-center bg-card px-4 pb-4">
      {identity.fiscal.is_reprint ? <Text testID="receipt-copy" className="text-center font-bold">{`COPY ${identity.fiscal.reprint_count}`}</Text> : null}
      <Text className="text-sm text-muted-foreground">Sales receipt</Text>
      <Text className="text-sm text-muted-foreground">{`Register: ${identity.register.name}`}</Text>
      <Text className="text-sm text-muted-foreground">{`${identity.software.name} ${identity.software.app_version}`}</Text>
    </View>
  );
}
