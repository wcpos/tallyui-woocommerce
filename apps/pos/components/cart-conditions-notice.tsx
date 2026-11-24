import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@tallyui/components';
import { unmetText, type UnmetStock } from '../lib/stock/conditions';

// v2 pos/cart/conditions-notice.tsx: Reduce opens the line's quantity keypad; here it sets what fits,
// because the library's line popover cannot be opened from outside.
export function CartConditionsNotice({ unmet, onReduce, onRemove }: {
  unmet: UnmetStock[]; onReduce(u: UnmetStock): void; onRemove(u: UnmetStock): void;
}) {
  if (!unmet.length) return null;
  return <View testID="cart-conditions-notice" className="border-warning/45 bg-warning-bg my-2 max-h-36 overflow-hidden rounded-lg border px-2">
    <ScrollView>
      {unmet.map((u, index) => <Pressable key={u.lineId} testID={`cart-condition-row-${u.lineId}`} accessibilityRole="button"
        className={`min-h-11 flex-row items-center gap-2${index > 0 ? ' border-t border-warning/30' : ''}`}
        onPress={() => u.fix === 'reduce' && u.fit > 0 ? onReduce(u) : onRemove(u)}>
        <Text className="flex-1 text-foreground" numberOfLines={1}>{unmetText(u)}</Text>
        <Text className="text-primary">{u.fix === 'reduce' && u.fit > 0 ? 'Reduce' : 'Remove'}</Text>
      </Pressable>)}
    </ScrollView>
  </View>;
}
