import { useState } from 'react';
import type { JSX } from 'react';
import { Linking, Pressable, View } from 'react-native';
import type { RxCollection } from 'rxdb';
import type { PosOrder } from '@tallyui/pos';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, IconButton, Text } from '@tallyui/components';
import { getInitials } from '../lib/cashier/initials';
import { sheetMoney, useCashierSalesToday } from '../lib/cashier/sheet-figures';

// v2's right side sheet: full height, flush right, no rounding, a left border.
const SIDE_SHEET = 'left-auto right-0 top-0 h-full max-w-lg translate-x-0 translate-y-0 rounded-none border-0 border-l';

function SalesTodayRow({ orders, cashierRef, currency, locale }: {
  orders: RxCollection<PosOrder>; cashierRef: string; currency: string; locale?: string;
}) {
  const total = useCashierSalesToday(orders, cashierRef, currency);
  return <View testID="user-sheet-sales-today" className="flex-row items-center justify-between px-3 py-2.5">
    <Text className="font-medium">Your sales today</Text>
    <Text className="text-lg font-semibold">{sheetMoney(total.totalMinor, currency, locale)}</Text>
  </View>;
}

export interface SheetDrawer { figure: string; verbs: string; opener?: string }

/** v2's DrawerDoor (packages/core/src/screens/main/pos/cart/user-sheet.tsx): the drawer tile over a row of its verbs. */
function DrawerDoor({ drawer, disabled, onPress }: { drawer: SheetDrawer; disabled: boolean; onPress(): void }) {
  return <Pressable testID="user-sheet-drawer" role="button" accessibilityLabel={`In the drawer, ${drawer.figure}`}
    disabled={disabled} onPress={onPress} className="rounded-lg border border-border">
    <View className="flex-row items-center gap-3 px-3 py-2.5">
      <View className="min-w-0 flex-1">
        <Text className="font-medium">In the drawer</Text>
        {drawer.opener && <Text testID="user-sheet-drawer-opener" className="text-xs text-muted-foreground">{drawer.opener}</Text>}
      </View>
      <Text className="text-lg font-semibold">{drawer.figure}</Text>
    </View>
    <View testID="user-sheet-drawer-verbs" className="flex-row items-center justify-between border-t border-border px-3 py-2">
      <Text className="text-sm text-primary">{drawer.verbs}</Text>
      <Text className="text-primary">›</Text>
    </View>
  </Pressable>;
}

export interface CashierOption { uuid: string; name: string }
export function CashierSheet(props: {
  name: string;
  cashiers: CashierOption[];
  blockedReason?: string;
  storeName?: string;
  sales?: { orders: RxCollection<PosOrder>; cashierRef: string; currency: string; locale?: string } | null;
  drawer?: SheetDrawer;
  /** Given, the drawer block is v2's drawer door: pressing it closes the sheet and opens the register's drawer flows. */
  onOpenDrawer?: () => void;
  adminUrl?: string;
  onSwitch(uuid: string): void;
  onRemove?(uuid: string): void;
  onAddAnother(): void;
  onSignOut(): void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<CashierOption | null>(null);
  return <>
    {/* v2's CashierEntry (packages/core/src/screens/main/pos/cart/register-bar.tsx): the initials avatar on the accent wash. */}
    <IconButton testID="register-bar-avatar" accessibilityLabel={props.name} disabled={Boolean(props.blockedReason)} className="rounded-lg bg-accent" onPress={() => setOpen(true)}>
      {/* v2's Avatar default `xs`: `size-5`, 20 px, with `text-2xs` initials (monorepo packages/components/src/avatar/index.tsx:42,58,76). */}
      <View testID="register-bar-avatar-initials" className="size-5 items-center justify-center rounded-full bg-primary">
        <Text className="text-2xs font-medium text-primary-foreground">{getInitials(props.name)}</Text>
      </View>
    </IconButton>
    {props.blockedReason && <Text>{props.blockedReason}</Text>}
    {open && <Dialog open onOpenChange={setOpen}>
      <DialogContent testID="user-sheet" className={SIDE_SHEET}>
        <DialogHeader>
          <DialogTitle>{props.name}</DialogTitle>
          {props.storeName && <DialogDescription testID="user-sheet-description">{props.storeName}</DialogDescription>}
        </DialogHeader>
        {props.sales && <SalesTodayRow {...props.sales} />}
        {props.drawer && (props.onOpenDrawer ? <DrawerDoor drawer={props.drawer} disabled={Boolean(props.blockedReason)}
          onPress={() => { setOpen(false); props.onOpenDrawer!(); }} />
          : <View testID="user-sheet-drawer" className="flex-row items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <Text className="font-medium">In the drawer</Text>
            <Text className="text-lg font-semibold">{props.drawer.figure}</Text>
          </View>)}
        <View testID="user-sheet-switch-user">
          <View className="mt-2 h-10 flex-row items-center justify-between border-b border-border px-2.5"><Text className="text-sm text-muted-foreground">Hand the till to</Text></View>
        {props.cashiers.map(cashier => <View key={cashier.uuid} className="flex-row gap-2">
          <Button testID={`user-sheet-user-${cashier.uuid}`}
            onPress={() => { setOpen(false); props.onSwitch(cashier.uuid); }}><Text>{`Switch to ${cashier.name}`}</Text></Button>
          {props.onRemove && <Button testID={`user-sheet-remove-${cashier.uuid}`} accessibilityLabel={`Remove ${cashier.name}`}
            onPress={() => setRemoving(cashier)}><Text>Remove</Text></Button>}
        </View>)}
          <Button testID="user-sheet-another-account" onPress={() => { setOpen(false); props.onAddAnother(); }}><Text>Another account</Text></Button>
        </View>
        {props.adminUrl && <View testID="user-sheet-foot" className="flex-row items-center gap-4 border-t border-border px-4 py-2">
          <Button variant="link" size="sm" testID="user-sheet-wp-admin" onPress={() => { void Linking.openURL(props.adminUrl!); }}><Text>WordPress Admin</Text></Button>
        </View>}
        <DialogFooter>
          <Button variant="destructive" testID="user-sheet-sign-out" onPress={() => { setOpen(false); props.onSignOut(); }}><Text>Sign out</Text></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>}
    {removing && <AlertDialog open onOpenChange={next => { if (!next) setRemoving(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Remove ${removing.name}`}</AlertDialogTitle>
          <AlertDialogDescription>Are you sure you want to remove this user? Removing a user from the POS will not affect any data on the server.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild onPress={() => setRemoving(null)}>
            <Button variant="outline" testID="user-sheet-remove-cancel"><Text>Cancel</Text></Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild onPress={() => { props.onRemove?.(removing.uuid); setRemoving(null); }}>
            <Button variant="destructive" testID="user-sheet-remove-confirm"><Text>Remove</Text></Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>}
  </>;
}
