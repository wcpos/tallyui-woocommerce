import type { JSX } from 'react';
import { View } from 'react-native';
import { Text } from '@tallyui/components';

export function InCartBadge({ count, testID, className }: { count: number; testID: string; className?: string }): JSX.Element | null {
  if (count <= 0) return null;
  return <View testID={testID} aria-label={`In cart: ${count}`}
    className={`size-6 items-center justify-center rounded-full bg-primary ${className ?? ''}`}>
    <Text className="text-xs font-semibold text-primary-foreground">{String(count)}</Text>
  </View>;
}
