import type { JSX } from 'react';
import { Pressable, View } from 'react-native';
import { IconButton, Text } from '@tallyui/components';
import { PlusIcon } from './icons';

export function InCartBadge({ count, testID, className }: { count: number; testID: string; className?: string }): JSX.Element | null {
  if (count <= 0) return null;
  return <View testID={testID} aria-label={`In cart: ${count}`}
    className={`size-6 items-center justify-center rounded-full bg-primary ${className ?? ''}`}>
    <Text className="text-xs font-semibold text-primary-foreground">{String(count)}</Text>
  </View>;
}

/** v2's in-cart-count.tsx:19-70 and product-row.tsx:55-68: add one without also pressing the row. */
export function InCartAdd({ count, testID, pressTestID, addTestID, onAdd }: {
  count: number; testID: string; pressTestID: string; addTestID: string; onAdd(): void;
}): JSX.Element {
  if (count <= 0) return <IconButton testID={addTestID} accessibilityLabel="Add to Cart" className="h-11 w-11"
    onPress={event => { event?.stopPropagation?.(); onAdd(); }}><PlusIcon size={18} className="text-muted-foreground" /></IconButton>;
  return <Pressable testID={pressTestID} accessibilityRole="button" accessibilityLabel={`In cart: ${count}`}
    hitSlop={8} className="min-h-11 min-w-11 items-center justify-center" onPress={event => { event?.stopPropagation?.(); onAdd(); }}>
    <InCartBadge count={count} testID={testID} />
  </Pressable>;
}
