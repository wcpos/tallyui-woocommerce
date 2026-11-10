// v2's drawer (WCPOS monorepo): the order and titles from `apps/main/app/(app)/(drawer)/_layout.tsx`
// (Store health's `marginTop: 'auto'` starts the bottom group), the body from
// `packages/core/src/screens/main/components/drawer-content/index.tsx` (`drawer-item-<route>`, the two
// groups, `drawer-panel`, the close-or-navigate press) and the footer from `drawer-content/version.tsx`.
// Built inside the app with no `@react-navigation/drawer`: the front drawer is a TallyUI Dialog side
// sheet. v2's wide-screen rail is a follow-up. v2 has no Logs item (Logs is a page inside Health);
// here `/logs` has no other way in, so it sits right after Store health.
import type { JSX } from 'react';
import { View } from 'react-native';
import { Button, Dialog, DialogContent, Text } from '@tallyui/components';
import { SOFTWARE_VERSION } from '../lib/software';

// v2's phone front drawer is 200 wide and flush left: full height, no rounding, a right border.
const FRONT_DRAWER = 'left-0 right-auto top-0 h-full w-[200px] max-w-[200px] translate-x-0 translate-y-0 gap-1 rounded-none border-0 border-r p-2';

export interface DrawerAreaHandlers {
  onOpenOrders?(): void;
  onOpenCustomers?(): void;
  onOpenReports?(): void;
  onOpenHealth?(): void;
  onOpenLogs?(): void;
  onOpenSettings?(): void;
}

/** The drawer's body: one item per area, the top group and the bottom group, then the version. */
export function DrawerContent(props: DrawerAreaHandlers & { onClose(): void }): JSX.Element {
  const { onClose } = props;
  const item = (key: string, label: string, open?: () => void) => open && (
    <Button key={key} variant="ghost" testID={`drawer-item-${key}`} className="justify-start" onPress={() => { onClose(); open(); }}>
      <Text>{label}</Text>
    </Button>
  );
  return <>
    <View testID="drawer-top-group">
      <Button variant="ghost" testID="drawer-item-pos" className="justify-start bg-accent" accessibilityState={{ selected: true }} onPress={onClose}>
        <Text>POS</Text>
      </Button>
      {item('orders', 'Orders', props.onOpenOrders)}
      {item('customers', 'Customers', props.onOpenCustomers)}
      {item('reports', 'Reports', props.onOpenReports)}
    </View>
    <View testID="drawer-bottom-group" className="mt-auto">
      {item('health', 'Store health', props.onOpenHealth)}
      {item('logs', 'Logs', props.onOpenLogs)}
      {item('settings', 'Settings', props.onOpenSettings)}
    </View>
    <Text testID="drawer-version" className="px-3 py-2 text-xs text-muted-foreground">{`Version ${SOFTWARE_VERSION}`}</Text>
  </>;
}

/** The front drawer: a left side sheet holding DrawerContent. Renders nothing while closed. */
export function DrawerSheet({ open, onOpenChange, ...handlers }: DrawerAreaHandlers & { open: boolean; onOpenChange(open: boolean): void }): JSX.Element | null {
  if (!open) return null;
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent testID="drawer-panel" accessibilityLabel="Menu" className={FRONT_DRAWER}>
        <DrawerContent {...handlers} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
