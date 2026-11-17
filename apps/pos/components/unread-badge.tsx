import type { JSX } from 'react';
import { Badge, Text } from '@tallyui/components';

/** v2's Badge at size sm, tone bad, max 99 (badge/index.tsx): nothing at 0, "99+" past 99. */
export function UnreadBadge({ count, testID }: { count: number; testID: string }): JSX.Element | null {
  if (count <= 0) return null;
  return <Badge testID={testID} variant="destructive" pointerEvents="none" className="h-4 min-w-4 justify-center px-1 py-0">
    <Text className="text-2xs font-bold tabular-nums text-destructive-foreground">{count > 99 ? '99+' : String(count)}</Text>
  </Badge>;
}
