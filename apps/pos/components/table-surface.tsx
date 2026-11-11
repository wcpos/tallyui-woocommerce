import { useState } from 'react';
import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { Path } from 'react-native-svg';
import { createSvgIcon, IconButton, Text } from '@tallyui/components';
import { useCatalogue } from '../lib/catalogue/catalogue-context';
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

// lucide `refresh-cw`, v2's `refresh` icon, as the catalogue's Sync button draws it.
const SyncIcon = createSvgIcon('SyncIcon', () => <><Path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><Path d="M21 3v5h-5" />
  <Path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><Path d="M8 16H3v5" /></>);

/** v2's DataTableFooter (components/data-table/footer.tsx) and SyncButton (components/sync-button.tsx): "Showing N of M"
 *  when something vouches for the total, else "Showing N", then the sync button, which turns while `active`. */
export function TableCount({ shown, total, active, onSync }: { shown: number; total: number | null; active: boolean; onSync?(): void }) {
  const count = total === null ? `Showing ${shown.toLocaleString()}` : `Showing ${shown.toLocaleString()} of ${total.toLocaleString()}`;
  return (
    <View testID="data-table-caption-row" className="flex-row items-center justify-end gap-1">
      <Text testID="data-table-count" className="text-sm text-muted-foreground">{count}</Text>
      <IconButton testID="data-table-sync" accessibilityLabel="Sync" variant="ghost" size="sm" disabled={active || !onSync} onPress={onSync}>
        <View testID={active ? 'data-table-sync-active' : undefined} className={active ? 'animate-spin' : undefined}><SyncIcon size={14} /></View>
      </IconButton>
    </View>
  );
}

/** The replicated collections' sync state (Products, Coupons): the catalogue's start, or a re-sync asked here. */
export function useCatalogueSync(): { active: boolean; sync?(): void } {
  const { catalogue, status } = useCatalogue();
  const [pending, setPending] = useState(false);
  const active = pending || status === 'starting' || status === 'syncing';
  if (!catalogue) return { active };
  return { active, sync() {
    setPending(true);
    catalogue.replication.reSync();
    void catalogue.replication.awaitInSync().catch(() => {}).finally(() => setPending(false));
  } };
}
