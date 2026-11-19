// An area screen's top row. On a wide window v2's area screens (Orders, Customers, Reports, Products,
// Coupons) have no title row and no Back button: the permanent rail is the navigation, and the screen's first
// row is its own toolbar, 16px below the top. A narrow window has no rail: AreaToolbar's row opens with v2's menu
// button and the title; a bare AreaHeader keeps its Back.
import { useContext, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { View } from 'react-native';
import { Button, IconButton, Text } from '@tallyui/components';
import { useSession } from '../lib/auth/session-context';
import { useIsWide } from '../lib/layout/wide';
import { useIsOnline } from '../lib/online/online-status';
import { runBeforeLeave } from '../lib/sale/before-leave';
import { useOutbox } from '../lib/sale/outbox-context';
import { toast } from '../lib/toast/toast';
import { AppRailArea, AppRailNavigate, AppRailShown } from './app-rail';
import { CashierSheet } from './cashier-sheet';
import { DrawerSheet } from './drawer-content';
import { NotificationBell } from './notification-bell';
import { BarStatusPill, MenuIcon } from './register-bar-shell';

export function AreaHeader({ title, backTestID, onBack, gap = true, controls, menu }: {
  title: string;
  backTestID: string;
  onBack(): void;
  /** False when the screen's body already pads its top. */
  gap?: boolean;
  /** The bar's trailing cluster when there is no rail (AreaToolbar's). */
  controls?: ReactNode;
  /** The row's leading menu button (AreaToolbar's); with it the row draws no Back. */
  menu?: ReactNode;
}): JSX.Element | null {
  const railShown = useContext(AppRailShown);
  if (railShown) return gap ? <View testID="area-header-gap" className="h-4" /> : null;
  return (
    <View className="flex-row items-center justify-between gap-2 p-4">
      {menu}
      <Text accessibilityRole="header" className="min-w-0 flex-1 font-semibold" numberOfLines={1}>{title}</Text>
      {controls}
      {!menu && <Button testID={backTestID} onPress={onBack}><Text>Back</Text></Button>}
    </View>
  );
}

/** The register bar's cashier entry (CashierSheet) for a page outside the till. A switch or another account
 *  first runs the till's before-leave handler, which parks its open cart, as the till's own sheet does. */
function AreaAvatar({ testID }: { testID: string }): JSX.Element | null {
  const auth = useSession() as ReturnType<typeof useSession> | null;
  const outbox = useOutbox();
  if (!auth?.session) return null;
  const { session, cashiers, switchCashier, startAddCashier, removeCashier, signOut } = auth;
  async function leaveThen(go: () => unknown) {
    const refusal = await runBeforeLeave();
    if (refusal !== null) { toast({ type: 'error', title: refusal }); return; }
    try { await go(); } catch { toast({ type: 'error', title: 'Could not switch cashier. Check the connection and try again.' }); }
  }
  return <View testID={testID}>
    <CashierSheet name={session.tokens.user.displayName} storeName={session.site.name} adminUrl={`${session.site.home}/wp-admin`}
      signedInAt={session.signedInAt} awaitingStore={outbox.enabled ? outbox.state.pending : 0}
      cashiers={cashiers.map(c => ({ uuid: c.tokens.user.uuid, name: c.tokens.user.displayName }))}
      onSwitch={uuid => { void leaveThen(() => switchCashier(uuid)); }} onAddAnother={() => { void leaveThen(startAddCashier); }}
      onRemove={removeCashier} onSignOut={signOut} />
  </View>;
}

// v2's page gutter (WCPOS monorepo packages/components/src/lib/ground.ts:46-72): `px-gutter`, 3 units (12 px), in a
// window; `px-4` (16 px) on a phone. Whole literals: the class compiler scans the source for them.
/** An area page's side inset for its bar and its own rows; TableSurface puts its card on the same gutter. */
export function useAreaGutter(): 'px-3' | 'px-4' {
  return useIsWide() ? 'px-3' : 'px-4';
}

/** v2's ManagementBar over PageBar (WCPOS monorepo `components/management-bar/index.tsx`,
 *  `packages/components/src/page-bar/index.tsx`): beside the rail, the search at the row's start up to v2's cap
 *  (`max-w-160`), then the area's own actions, then the bell and the avatar (`BarControls`). With no rail the title
 *  row carries the cluster and the search takes a row of its own, as v2's phone bar does. An area passes its
 *  display options (v2's `DisplayOptions` settings icon, area-display-options.tsx) as a child, so they sit before the bell. */
export function AreaToolbar({ area, title, onBack, titleSlot, search, controls = 'all', children }: {
  /** The testID stem: `<area>-bar`, `<area>-menu`, `<area>-bar-offline`, `<area>-bar-bell`, `<area>-bar-avatar`. */
  area: string;
  title: string;
  onBack(): void;
  /** A scoped room's title (v2 `PageBar` `titleSlot`, Reports): at the row's start beside the rail; with no rail,
   *  a row of its own under the title row, which keeps the menu and `title`. */
  titleSlot?: ReactNode;
  search?: ReactNode;
  /** v2's ManagementBar `controls` (management-bar/index.tsx:15-20, :52): 'phone' draws the bell and the avatar on a
   *  phone alone, and beside the rail the row is the title (Support, support/index.tsx:42). */
  controls?: 'all' | 'phone';
  /** The area's own actions, drawn before the bell. */
  children?: ReactNode;
}): JSX.Element {
  const online = useIsOnline();
  const railShown = useContext(AppRailShown);
  const railArea = useContext(AppRailArea);
  const navigate = useContext(AppRailNavigate);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const px = useAreaGutter();
  const offline = !online && <BarStatusPill testID={`${area}-bar-offline`} label="Offline" />;
  const cluster = <View testID={`${area}-bar-controls`} className="flex-row items-center gap-1">
    {children}
    {offline}
    <NotificationBell testID={`${area}-bar-bell`} />
    <AreaAvatar testID={`${area}-bar-avatar`} />
  </View>;
  const searchBox = search ? <View testID={`${area}-bar-search`} className={railShown ? 'min-w-0 max-w-160 flex-1' : 'min-w-0 flex-1'}>{search}</View> : null;
  const slot = titleSlot != null
    ? <View testID={`${area}-bar-title-slot`} className="min-w-0 shrink flex-row items-center">{titleSlot}</View> : null;
  // v2's phone PageBar (page-bar/index.tsx:94-112): the menu button, labelled "Menu" (bar-controls/index.tsx:22-31,
  // common.menu), opens the front drawer, then the title in semibold; no Back.
  const menu = <IconButton testID={`${area}-menu`} accessibilityLabel="Menu" className="-ml-2" onPress={() => setDrawerOpen(true)}>
    <MenuIcon size={20} />
  </IconButton>;
  if (!railShown) return <View testID={`${area}-bar`}>
    <AreaHeader title={title} backTestID={`${area}-back`} onBack={onBack} controls={cluster} menu={menu} />
    {slot && <View testID={`${area}-bar-slot-row`} className={`flex-row pb-2 ${px}`}>{slot}</View>}
    {searchBox && <View testID={`${area}-bar-search-row`} className={`flex-row pb-2 ${px}`}>{searchBox}</View>}
    <DrawerSheet open={drawerOpen} onOpenChange={setDrawerOpen} active={railArea ?? undefined} onNavigate={navigate ?? undefined} />
  </View>;
  return (
    <View testID={`${area}-bar`} className={`flex-row items-center gap-4 pb-2 pt-4 ${px}`}>
      {controls === 'phone' ? <>
        {/* v2's wide PageBar title (page-bar/index.tsx): a control-height box, semibold; the status badge stays. */}
        <View className="min-h-11 min-w-0 shrink justify-center">
          <Text testID={`${area}-bar-title`} accessibilityRole="header" className="font-semibold" numberOfLines={1}>{title}</Text>
        </View>
        {offline}
      </> : slot}
      <View className="min-w-0 flex-1 flex-row">{searchBox}</View>
      {controls === 'all' && cluster}
    </View>
  );
}
