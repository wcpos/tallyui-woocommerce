import type { JSX } from 'react';
import { View } from 'react-native';
import { Text } from '@tallyui/components';
import { useIsOnline } from '../lib/online/online-status';

// v2's online badge (bar-controls `useOnlineBadge`, LEDGER line 4): one word, "Offline", in the warning
// tone, for an offline device and an unreachable store alike; nothing while the store answers. Drawn as
// v2's StatusBadge: the dot carries the tone, the word keeps the foreground colour.
export function OfflineBadge({ testID }: { testID: string }): JSX.Element | null {
  const online = useIsOnline();
  if (online) return null;
  return (
    <View testID={testID} className="flex-row items-center gap-1.5">
      <View aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />
      <Text className="shrink text-sm">Offline</Text>
    </View>
  );
}
