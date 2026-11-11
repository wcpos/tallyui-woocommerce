// v2's register bar (WCPOS monorepo `packages/core/src/screens/main/pos/cart/register-bar.tsx`): the menu,
// the store as the place, the status pill, a spacer, then the cashier entry. v2 wraps the place in a
// `register-bar-store` button only when the login has more than one store; this app has one store per
// connection, so the place is plain text. On a wide window the app rail (app-rail.tsx) replaces the menu, as v2's permanent drawer does; the bell is notification-bell.tsx.
// As v2's (cart/index.tsx RegisterBar, the column's first row) it heads the cart column, and it has no register
// button: the avatar's sheet is the one door to the register panel (v2 register-bar.tsx, Paul 2026-10-29).
import { useContext } from 'react';
import type { JSX, ReactNode } from 'react';
import { View } from 'react-native';
import { Line } from 'react-native-svg';
import { createSvgIcon, describeRegisterBarPill, IconButton, Text } from '@tallyui/components';
import type { RegisterBarPill } from '@tallyui/components';
import type { RegisterSession } from '@tallyui/pos';
import { useIsOnline } from '../lib/online/online-status';
import { useRegister } from '../lib/register/register-context';
import { AppRailShown } from './app-rail';
import { NotificationBell } from './notification-bell';

const MenuIcon = createSvgIcon('MenuIcon', () => <><Line x1={4} y1={6} x2={20} y2={6} /><Line x1={4} y1={12} x2={20} y2={12} /><Line x1={4} y1={18} x2={20} y2={18} /></>);

export interface BarRegister {
  enabled: boolean;
  boundRegisterId: string | null;
  session: { status: RegisterSession['status']; approval_required?: boolean } | null;
  overdue: boolean;
  closing: boolean;
}

/** The pill's words: sessions off, only Offline; sessions on, TallyUI's register pill. */
export function registerBarPill(register: BarRegister | null | undefined, online: boolean): RegisterBarPill | null {
  if (!register?.enabled) return online ? null : 'Offline';
  return describeRegisterBarPill({
    registerId: register.boundRegisterId,
    online,
    sessionStatus: register.session?.status ?? null,
    overdue: register.overdue,
    approvalRequired: register.session?.approval_required,
    sessionsOn: true,
    closing: register.closing,
  });
}

export interface RegisterBarShellProps {
  storeName: string;
  onOpenMenu(): void;
  /** The cashier entry, drawn last (CashierSheet's `register-bar-avatar` button, or the fallback). */
  avatar: ReactNode;
}

export function RegisterBarShell({ storeName, onOpenMenu, avatar }: RegisterBarShellProps): JSX.Element {
  const register = useRegister();
  const online = useIsOnline();
  const railShown = useContext(AppRailShown);
  // The window's one pill: the register's state with sessions on, Offline alone with them off.
  const pill = registerBarPill(register, online);
  // The pill is drawn as v2's StatusBadge and offline-badge.tsx draw a status: the dot carries the tone,
  // the word keeps the foreground colour.
  return (
    <View testID="register-bar-shell" className="h-12 flex-row items-center gap-2 border-b border-border px-2">
      {/* v2 register-bar.helpers.ts `place` adds " · Register" only when the store has more than one register; a Tally till has one. */}
      {!railShown && <IconButton testID="pos-drawer-open-button" accessibilityLabel="Menu" onPress={onOpenMenu}><MenuIcon size={20} /></IconButton>}
      <View className="min-w-0 shrink"><Text testID="register-bar-place" className="text-base font-semibold" numberOfLines={1}>{storeName}</Text></View>
      {pill && <View testID="register-bar-pill" className="flex-row items-center gap-1.5">
        <View aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />
        <Text className="shrink text-sm">{pill}</Text>
      </View>}
      <View className="flex-1" />
      <NotificationBell />
      {avatar}
    </View>
  );
}
