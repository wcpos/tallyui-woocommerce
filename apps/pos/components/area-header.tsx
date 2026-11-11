// An area screen's top row. On a wide window v2's area screens (Orders, Customers, Reports, Products,
// Coupons) have no title row and no Back button: the permanent rail is the navigation, and the screen's first
// row is its own toolbar, 16px below the top. A narrow window has no rail, so the title and Back stay.
import { useContext } from 'react';
import type { JSX, ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import { useSession } from '../lib/auth/session-context';
import { runBeforeLeave } from '../lib/sale/before-leave';
import { toast } from '../lib/toast/toast';
import { AppRailShown } from './app-rail';
import { CashierSheet } from './cashier-sheet';
import { NotificationBell } from './notification-bell';

export function AreaHeader({ title, backTestID, onBack, gap = true, controls }: {
  title: string;
  backTestID: string;
  onBack(): void;
  /** False when the screen's body already pads its top. */
  gap?: boolean;
  /** The bar's trailing cluster, beside Back when there is no rail (AreaToolbar's). */
  controls?: ReactNode;
}): JSX.Element | null {
  const railShown = useContext(AppRailShown);
  if (railShown) return gap ? <View testID="area-header-gap" className="h-4" /> : null;
  return (
    <View className="flex-row items-center justify-between gap-2 p-4">
      <Text accessibilityRole="header" className="min-w-0 flex-1" numberOfLines={1}>{title}</Text>
      {controls}
      <Button testID={backTestID} onPress={onBack}><Text>Back</Text></Button>
    </View>
  );
}

/** The register bar's cashier entry (CashierSheet) for a page outside the till. A switch or another account
 *  first runs the till's before-leave handler, which parks its open cart, as the till's own sheet does. */
function AreaAvatar({ testID }: { testID: string }): JSX.Element | null {
  const auth = useSession() as ReturnType<typeof useSession> | null;
  if (!auth?.session) return null;
  const { session, cashiers, switchCashier, startAddCashier, removeCashier, signOut } = auth;
  async function leaveThen(go: () => unknown) {
    const refusal = await runBeforeLeave();
    if (refusal !== null) { toast({ type: 'error', title: refusal }); return; }
    try { await go(); } catch { toast({ type: 'error', title: 'Could not switch cashier. Check the connection and try again.' }); }
  }
  return <View testID={testID}>
    <CashierSheet name={session.tokens.user.displayName} storeName={session.site.name} adminUrl={`${session.site.home}/wp-admin`}
      cashiers={cashiers.map(c => ({ uuid: c.tokens.user.uuid, name: c.tokens.user.displayName }))}
      onSwitch={uuid => { void leaveThen(() => switchCashier(uuid)); }} onAddAnother={() => { void leaveThen(startAddCashier); }}
      onRemove={removeCashier} onSignOut={signOut} />
  </View>;
}

/** v2's ManagementBar over PageBar (WCPOS monorepo `components/management-bar/index.tsx`,
 *  `packages/components/src/page-bar/index.tsx`): beside the rail, the search at the row's start up to v2's cap
 *  (`max-w-160`), then the area's own actions, then the bell and the avatar (`BarControls`). With no rail the title
 *  row carries the cluster and the search takes a row of its own, as v2's phone bar does. No area here has v2's
 *  column settings (`DisplayOptions`) yet, so no settings icon is drawn. */
export function AreaToolbar({ area, title, onBack, search, children }: {
  /** The testID stem: `<area>-bar`, `<area>-back`, `<area>-bar-bell`, `<area>-bar-avatar`. */
  area: string;
  title: string;
  onBack(): void;
  search?: ReactNode;
  /** The area's own actions, drawn before the bell. */
  children?: ReactNode;
}): JSX.Element {
  const railShown = useContext(AppRailShown);
  const controls = <View testID={`${area}-bar-controls`} className="flex-row items-center gap-1">
    {children}
    <NotificationBell testID={`${area}-bar-bell`} />
    <AreaAvatar testID={`${area}-bar-avatar`} />
  </View>;
  const searchBox = search ? <View testID={`${area}-bar-search`} className={railShown ? 'min-w-0 max-w-160 flex-1' : 'min-w-0 flex-1'}>{search}</View> : null;
  if (!railShown) return <View testID={`${area}-bar`}>
    <AreaHeader title={title} backTestID={`${area}-back`} onBack={onBack} controls={controls} />
    {searchBox && <View className="flex-row px-4 pb-2">{searchBox}</View>}
  </View>;
  return (
    <View testID={`${area}-bar`} className="flex-row items-center gap-4 px-4 pb-2 pt-4">
      <View className="min-w-0 flex-1 flex-row">{searchBox}</View>
      {controls}
    </View>
  );
}
