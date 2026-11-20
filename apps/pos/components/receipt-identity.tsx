import { View } from 'react-native';
import { Text } from '@tallyui/components';
import type { ReceiptIdentity as Identity } from '../lib/receipts/receipt-identity';
import { formatPrintedAt, useReceiptPrintedAt } from '../lib/receipts/use-receipt-printed-at';

export function ReceiptCopyLine({ count }: { count: number }) {
  const at = useReceiptPrintedAt();
  // v2's copy line (default-thermal-template.ts:132-134): {{i18n.copy}} {{fiscal.reprint_count}} · {{order.printed.datetime}}.
  return <Text testID="receipt-copy" className="text-center font-bold">{`COPY ${count} · ${formatPrintedAt(at)}`}</Text>;
}

export function ReceiptIdentity({ identity }: { identity: Identity }) {
  return (
    <View testID="receipt-identity" className="w-full max-w-md self-center bg-card px-4 pb-4">
      {identity.fiscal.is_reprint ? <ReceiptCopyLine count={identity.fiscal.reprint_count} /> : null}
      <Text className="text-sm text-muted-foreground">Sales receipt</Text>
      <Text className="text-sm text-muted-foreground">{`Register: ${identity.register.name}`}</Text>
      <Text className="text-sm text-muted-foreground">{`${identity.software.name} ${identity.software.app_version}`}</Text>
    </View>
  );
}
