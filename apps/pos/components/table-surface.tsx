import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { useIsWide } from '../lib/layout/wide';

// v2's surface (WCPOS monorepo packages/core/src/screens/main/components/data-table/surface.tsx). v2's page
// gutter (`--spacing-gutter`, 3 units, `ground.ts` `mx-gutter`/`px-gutter`) maps to the 4 units these screens
// already inset their search and chips by, so the card's edges line up with the search box above it.
// v2's phone is `useIsPhone` (packages/components/src/lib/device.ts: width < 768 or height < 480), which is
// `!useIsWide()` here.

/** The card every area table sits on: inset and rounded in a window, edge to edge under a hairline on a phone. */
export function TableSurface({ className, ...props }: ViewProps & { className?: string }) {
  const phone = !useIsWide();
  const shape = phone ? 'mb-2 border-t' : 'mx-4 mb-2 overflow-hidden rounded-lg border';
  return <View className={['min-h-0 flex-1 border-border bg-card', shape, className].filter(Boolean).join(' ')} {...props} />;
}

/** The count row under the card: the card's gutter, then the cell's own 12, so its text lines up with the cells'. */
export function CaptionRowInset({ children }: { children: ReactNode }) {
  const phone = !useIsWide();
  return (
    <View testID="data-table-caption-inset" className={phone ? 'px-1 pb-4' : 'px-4 pb-4'}>
      <View className="px-3">{children}</View>
    </View>
  );
}
