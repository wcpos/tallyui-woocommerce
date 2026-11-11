// v2's status: a coloured dot, then the word in the foreground (WCPOS monorepo
// `packages/components/src/status-badge/index.tsx`: `flex-row items-center gap-1.5`, the dot
// `size-2 shrink-0 rounded-full`). v2's tones map onto this app's theme tokens
// (`packages/components/src/lib/tone.ts`): ok `bg-ok` -> `bg-success`, warning `bg-warning` -> `bg-warning`,
// bad `bg-bad` (= destructive) -> `bg-destructive`, muted `bg-muted-foreground` -> `bg-muted-foreground`.
// Deviation: v2 sets the word `text-sm`, its table size; here the word takes this app's table text size (Text's default).
import type { JSX } from 'react';
import { View } from 'react-native';
import { Text } from '@tallyui/components';

export type StatusTone = 'success' | 'warning' | 'destructive' | 'muted';

const DOT: Record<StatusTone, string> = {
  success: 'bg-success', warning: 'bg-warning', destructive: 'bg-destructive', muted: 'bg-muted-foreground',
};

export function StatusDot({ tone, label, testID }: { tone: StatusTone; label: string; testID?: string }): JSX.Element {
  return (
    <View testID={testID} className="flex-row items-center gap-1.5">
      <View testID={testID ? `${testID}-dot` : undefined} aria-hidden className={`size-2 shrink-0 rounded-full ${DOT[tone]}`} />
      <Text className="shrink text-foreground">{label}</Text>
    </View>
  );
}
