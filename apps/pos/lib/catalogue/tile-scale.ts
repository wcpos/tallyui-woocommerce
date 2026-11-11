import { Platform, useWindowDimensions } from 'react-native';

// v2's Auto density step (WCPOS monorepo packages/components/src/lib/scale.ts l.65-69 `SCALE_STEPS`,
// l.80 `AUTO_COMPACT_UNDER`, l.96-101 `resolveStep`; packages/core/src/contexts/scale/index.tsx l.50-53):
// under 640 px, the window's width on web or its shortest side on native, the app is Compact. Compact's
// body type is 13 px and its spacing unit 3.5 px, so the Poster words' `p-2.5` (poster-tile/index.tsx
// l.353) is 8.75 px. A tile's name is v2's body type (browse/term-tile.tsx l.133 sets no size); Tally's
// tiles draw it at `text-base`, and keep that from 640 px up.
const AUTO_COMPACT_UNDER = 640;

/** Whether the window is in v2's Compact step. */
export function useCompactTiles(): boolean {
  const { width, height } = useWindowDimensions();
  return (Platform.OS === 'web' ? width : Math.min(width, height)) < AUTO_COMPACT_UNDER;
}

/** The size class of a tile's name. */
export const tileNameSize = (compact: boolean) => compact ? 'text-[13px]' : 'text-base';

/** A tile's words block at the foot of the card, with its inset. */
export const tileWords = (compact: boolean) =>
  `absolute bottom-0 left-0 right-0 max-h-full gap-0.5 overflow-hidden ${compact ? 'px-[8.75px] pb-[8.75px]' : 'px-2.5 pb-2.5'}`;
