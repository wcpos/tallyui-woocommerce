import type { JSX } from 'react';
import { View } from 'react-native';
import { Text } from '@tallyui/components';
import type { TileStockMark } from '../lib/catalogue/tile-words';
import { BoxIcon, ClockIcon } from './icons';

// v2's poster-tile/stock-pill.tsx:8-43: a card pill with the box glyph and the count, or the clock and Backorder.
const PILL = 'h-5.5 flex-row items-center gap-1 rounded-full border border-border bg-card px-2';

export function StockPill({ mark, testID }: { mark: TileStockMark; testID?: string }): JSX.Element {
  return <View testID={testID} accessibilityLabel={mark.label} className={PILL}>
    {mark.kind === 'count' ? <>
      <BoxIcon testID={`${testID}-glyph`} size={14} strokeWidth={1.5} className="text-foreground" />
      <Text className="text-xs font-bold tabular-nums text-foreground">{mark.value}</Text>
    </> : <>
      <ClockIcon testID={`${testID}-glyph`} size={14} strokeWidth={1.5} className="text-muted-foreground" />
      {/* v2's `help` text (text/ladder.ts:15), bold. */}
      <Text className="text-xs font-bold text-muted-foreground">{mark.label}</Text>
    </>}
  </View>;
}
