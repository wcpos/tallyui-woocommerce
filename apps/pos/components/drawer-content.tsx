// v2's drawer (WCPOS monorepo): the order and titles from `apps/main/app/(app)/(drawer)/_layout.tsx`
// (Store health's `marginTop: 'auto'` starts the bottom group), the body from
// `packages/core/src/screens/main/components/drawer-content/index.tsx` (`drawer-item-<route>`, the two
// groups, `drawer-panel`, the close-or-navigate press) and the footer from `drawer-content/version.tsx`.
// Built inside the app with no `@react-navigation/drawer`: the front drawer is a TallyUI Dialog side
// sheet. On wide windows v2's permanent rail is app-rail.tsx; this sheet is the phone's front drawer. As in v2 there is no Logs item:
// Logs is a Store health page (/health/logs).
import type { JSX } from 'react';
import { View } from 'react-native';
import { Button, Dialog, DialogContent, Text } from '@tallyui/components';
import { useUnreadLogsCount } from '../lib/logs/unread-errors';
import { RAIL_FOOT, RAIL_LABEL, RAIL_TOP, type RailKey } from '../lib/layout/rail-routes';
import { VersionAbout } from './about-dialog';
import { RAIL_GLYPH } from './app-rail';
import { UnreadBadge } from './unread-badge';

// v2's phone front drawer is 200 wide and flush left: full height, no rounding, a right border, on the window rail's
// surface (apps/main/app/(app)/(drawer)/_layout.tsx:84-107 `--color-sidebar` / `--color-sidebar-border`, aliases of
// --rail / --rail-border at apps/main/global.css:407-409). Rail tokens only, so every theme follows.
const FRONT_DRAWER = 'left-0 right-auto top-0 h-full w-[200px] max-w-[200px] translate-x-0 translate-y-0 gap-1 rounded-none border-0 border-r border-rail-border bg-rail p-2';
// v2's NavItem at size `drawer` (packages/components/src/nav-item/index.tsx:31-34, 54-71): 48 tall, `rounded-lg px-3 gap-3`,
// the label in the rail's ink; the selected item on `bg-rail-selected` in `text-rail-selected-foreground`.
// Hover and press wash the others in `rail-accent` (pressable-surface/index.tsx:29); the selected one keeps `rail-selected`.
const ITEM = 'h-12 justify-start gap-3 rounded-lg px-3';
const SELECTED = 'bg-rail-selected text-rail-selected-foreground web:hover:bg-rail-selected active:bg-rail-selected';
const UNSELECTED = 'text-rail-foreground web:hover:bg-rail-accent active:bg-rail-accent';

export interface DrawerAreaHandlers {
  onOpenProducts?(): void;
  onOpenOrders?(): void;
  onOpenCoupons?(): void;
  onOpenCustomers?(): void;
  onOpenReports?(): void;
  onOpenHealth?(): void;
  onOpenSettings?(): void;
}

/** The drawer's body: one item per area, the top group and the bottom group, then the version. */
export function DrawerContent(props: DrawerAreaHandlers & { onClose(): void; unreadErrors?: number }): JSX.Element {
  const { onClose, unreadErrors } = props;
  const handlers: Record<Exclude<RailKey, 'pos'>, (() => void) | undefined> = {
    products: props.onOpenProducts, orders: props.onOpenOrders, coupons: props.onOpenCoupons, customers: props.onOpenCustomers,
    reports: props.onOpenReports, health: props.onOpenHealth, settings: props.onOpenSettings,
  };
  const item = (key: RailKey) => {
    const Glyph = RAIL_GLYPH[key];
    const open = key === 'pos' ? onClose : handlers[key];
    return open && (
      <Button key={key} variant="ghost" testID={`drawer-item-${key}`}
        className={`${ITEM} ${key === 'pos' ? SELECTED : UNSELECTED}`}
        accessibilityState={key === 'pos' ? { selected: true } : undefined} onPress={() => { if (key !== 'pos') onClose(); open(); }}>
        <Glyph size={24} data-testid={`drawer-glyph-${key}`} />
        <Text testID={`drawer-label-${key}`} className={key === 'pos' ? 'text-rail-selected-foreground' : 'text-rail-foreground'}>{RAIL_LABEL[key]}</Text>
        {/* v2 drawer-content/index.tsx:76-87 draws icon then label; the badge trails the label here (O3). */}
        {key === 'health' && <UnreadBadge count={unreadErrors ?? 0} testID="drawer-badge-health" />}
      </Button>
    );
  };
  return <>
    <View testID="drawer-top-group">
      {RAIL_TOP.map(item)}
    </View>
    <View testID="drawer-bottom-group" className="mt-auto">
      {RAIL_FOOT.map(item)}
    </View>
    {/* v2's drawer-content/version.tsx:118-121: `text-sidebar-foreground` (the rail's ink) at half opacity. */}
    <VersionAbout presentation="front" />
  </>;
}

/** The front drawer: a left side sheet holding DrawerContent. Renders nothing while closed. */
export function DrawerSheet({ open, onOpenChange, ...handlers }: DrawerAreaHandlers & { open: boolean; onOpenChange(open: boolean): void }): JSX.Element | null {
  const unreadErrors = useUnreadLogsCount();
  if (!open) return null;
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent testID="drawer-panel" accessibilityLabel="Menu" className={FRONT_DRAWER}>
        <DrawerContent {...handlers} unreadErrors={unreadErrors} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
