import type { JSX } from 'react';
import { View } from 'react-native';
import { Text } from '@tallyui/components';
import { formatBytes, isReadyToSell, totalLocalRecords } from '../lib/health/database-stats';

// v2's StatHeader on Store health > Database (packages/core/src/screens/main/health/database.tsx).
function Stat({ testID, value, label, tone = '' }: {
  testID: string; value: string; label: string; tone?: string;
}): JSX.Element {
  return (
    <View testID={testID}>
      <Text testID={`${testID}-value`} className={`text-lg font-semibold tabular-nums${tone ? ` ${tone}` : ''}`}>{value}</Text>
      <Text className="text-sm text-muted-foreground">{label}</Text>
    </View>
  );
}

export function DatabaseStats({ counts, storageBytes, waiting }: {
  counts: Record<string, number | null>; storageBytes: number | null; waiting: number;
}): JSX.Element {
  const products = counts.products;
  const ready = typeof products === 'number' && isReadyToSell(products);
  const storage = formatBytes(storageBytes);
  return (
    <View testID="db-stats" className="flex-row flex-wrap gap-x-8 gap-y-3">
      <Stat testID="db-stat-ready" value={ready ? '✓ Ready to sell' : 'Preparing…'} tone={ready ? 'text-success' : ''}
        label="catalog & open orders local" />
      <Stat testID="db-stat-records" value={String(totalLocalRecords(counts))} label="records on this device" />
      {storage !== null && <Stat testID="db-stat-storage" value={storage} label="storage used" />}
      {/* Every queued outbound record counts the same, as in v2 */}
      <Stat testID="db-stat-waiting" value={String(waiting)} tone={waiting > 0 ? 'text-destructive' : 'text-success'}
        label="changes waiting to send" />
    </View>
  );
}
