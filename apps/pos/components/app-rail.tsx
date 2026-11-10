// v2's permanent icon rail (WCPOS monorepo): `apps/main/app/(app)/(drawer)/_layout.tsx` (the drawer is
// `permanent` when not a phone, 64 wide, the sidebar colour with a right border, Store health's
// `marginTop: 'auto'` starting the foot group) and `packages/core/src/screens/main/components/drawer-content/index.tsx`
// (icon-only `h-12 w-12 rounded-lg` items labelled with the area's title, the selected item on the card colour,
// `drawer-panel-permanent`, `drawer-top-group`, `drawer-bottom-group`, `drawer-item-<route>`, pressing the
// focused item does nothing), with the version from `drawer-content/version.tsx`.
// Deviations: no Products, Coupons or Support item (this app has none of those areas); Logs is kept after
// Store health, as in drawer-content.tsx; no hover tooltip; the version does not open an About dialog.
// TallyUI has no sidebar or rail-selected token, so the rail is `bg-muted` and the selected item `bg-card`.
import { createContext } from 'react';
import type { JSX, ReactNode } from 'react';
import { View } from 'react-native';
import { Circle, Line, Path, Rect } from 'react-native-svg';
import { createSvgIcon, IconButton, Text } from '@tallyui/components';
import { RAIL_FOOT, RAIL_LABEL, RAIL_TOP, railKeyForPath } from '../lib/layout/rail-routes';
import type { RailKey } from '../lib/layout/rail-routes';
import { SOFTWARE_VERSION } from '../lib/software';

const RegisterIcon = createSvgIcon('RegisterIcon', () => <><Rect x={3} y={9} width={18} height={12} rx={2} /><Line x1={7} y1={4} x2={17} y2={4} /><Line x1={12} y1={4} x2={12} y2={9} /><Line x1={7} y1={15} x2={17} y2={15} /></>);
const ReceiptIcon = createSvgIcon('ReceiptIcon', () => <><Path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" /><Line x1={9} y1={7} x2={15} y2={7} /><Line x1={9} y1={11} x2={15} y2={11} /><Line x1={9} y1={15} x2={13} y2={15} /></>);
const CustomersIcon = createSvgIcon('CustomersIcon', () => <><Circle cx={9} cy={8} r={3.5} /><Path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" /><Path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><Path d="M18 14c2.5.5 4 3 4 6" /></>);
const ReportsIcon = createSvgIcon('ReportsIcon', () => <><Line x1={4} y1={20} x2={20} y2={20} /><Rect x={5} y={11} width={3} height={6} /><Rect x={10.5} y={6} width={3} height={11} /><Rect x={16} y={9} width={3} height={8} /></>);
const HealthIcon = createSvgIcon('HealthIcon', () => <Path d="M22 12h-4l-3 9L9 3l-3 9H2" />);
const LogsIcon = createSvgIcon('LogsIcon', () => <><Line x1={8} y1={6} x2={21} y2={6} /><Line x1={8} y1={12} x2={21} y2={12} /><Line x1={8} y1={18} x2={21} y2={18} /><Line x1={3} y1={6} x2={3.01} y2={6} /><Line x1={3} y1={12} x2={3.01} y2={12} /><Line x1={3} y1={18} x2={3.01} y2={18} /></>);
const SettingsIcon = createSvgIcon('SettingsIcon', () => <><Line x1={4} y1={21} x2={4} y2={14} /><Line x1={4} y1={10} x2={4} y2={3} /><Line x1={12} y1={21} x2={12} y2={12} /><Line x1={12} y1={8} x2={12} y2={3} /><Line x1={20} y1={21} x2={20} y2={16} /><Line x1={20} y1={12} x2={20} y2={3} /><Line x1={2} y1={14} x2={6} y2={14} /><Line x1={10} y1={8} x2={14} y2={8} /><Line x1={18} y1={16} x2={22} y2={16} /></>);

const GLYPH: Record<RailKey, typeof RegisterIcon> = {
  pos: RegisterIcon, orders: ReceiptIcon, customers: CustomersIcon, reports: ReportsIcon,
  health: HealthIcon, logs: LogsIcon, settings: SettingsIcon,
};

/** True while AppFrame draws the rail; the register bar then draws no menu button. */
export const AppRailShown = createContext(false);

export function AppRail({ active, onNavigate }: { active: RailKey; onNavigate(to: RailKey): void }): JSX.Element {
  const item = (key: RailKey) => {
    const Glyph = GLYPH[key];
    return (
      <IconButton key={key} size="lg" testID={`drawer-item-${key}`} accessibilityLabel={RAIL_LABEL[key]}
        // react-native-web reads aria-selected, not accessibilityState (as coupon-entry.tsx).
        accessibilityState={{ selected: key === active }} aria-selected={key === active}
        className={key === active ? 'rounded-lg bg-card text-foreground' : 'rounded-lg text-muted-foreground'}
        onPress={() => { if (key !== active) onNavigate(key); }}>
        <Glyph size={24} />
      </IconButton>
    );
  };
  return (
    <View testID="drawer-panel-permanent" className="w-16 items-center border-r border-border bg-muted px-2 py-2">
      <View testID="drawer-top-group" className="items-center gap-2">{RAIL_TOP.map(item)}</View>
      <View testID="drawer-bottom-group" className="mt-auto items-center gap-2">{RAIL_FOOT.map(item)}</View>
      <Text testID="drawer-version" className="py-2 text-center text-xs text-muted-foreground opacity-50">{`v ${SOFTWARE_VERSION}`}</Text>
    </View>
  );
}

export function AppFrame({ wide, pathname, onNavigate, children }: {
  wide: boolean;
  pathname: string;
  onNavigate(from: RailKey, to: RailKey): void;
  children: ReactNode;
}): JSX.Element {
  const key = railKeyForPath(pathname);
  const shown = wide && key !== null;
  return (
    <AppRailShown.Provider value={shown}>
      <View className="flex-1 flex-row bg-background">
        {shown && <AppRail active={key} onNavigate={to => onNavigate(key, to)} />}
        <View className="flex-1">{children}</View>
      </View>
    </AppRailShown.Provider>
  );
}
