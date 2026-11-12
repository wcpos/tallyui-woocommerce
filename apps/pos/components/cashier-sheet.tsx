import { useState } from 'react';
import type { JSX } from 'react';
import { Linking, Pressable, View } from 'react-native';
import type { RxCollection } from 'rxdb';
import type { PosOrder } from '@tallyui/pos';
import { Path } from 'react-native-svg';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, createSvgIcon, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, IconButton, Text, XIcon } from '@tallyui/components';
import { getInitials } from '../lib/cashier/initials';
import { sheetMoney, useCashierSalesToday } from '../lib/cashier/sheet-figures';
import { SheetCloseButton } from './catalogue-display-options';

// v2's tabler glyphs at their 1.5 stroke (monorepo packages/components/src/icon/components/tabler/plus.tsx:14,
// openExternal.tsx:14).
const PlusIcon = createSvgIcon('PlusIcon', () => <Path d="M12 5v14m-7-7h14" />);
const OpenExternalIcon = createSvgIcon('OpenExternalIcon', () => <Path d="M12 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6m-7 1 9-9m-5 0h5v5" />);

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
    {/* v2's CashierEntry (packages/core/src/screens/main/components/cashier-entry/index.tsx:91-101): the initials avatar
        on the bar itself; v2's `wash="accent"` is a press and hover wash only (pressable-surface/index.tsx:28), not a fill.
        The ghost IconButton gives the press wash (active:bg-accent); it has no hover wash. */}
    <IconButton testID="register-bar-avatar" accessibilityLabel={props.name} disabled={Boolean(props.blockedReason)} className="rounded-lg" onPress={() => setOpen(true)}>
      {/* v2's Avatar default `xs`: `size-5`, 20 px, with `text-2xs` initials (monorepo packages/components/src/avatar/index.tsx:42,58,76). */}
      <View testID="register-bar-avatar-initials" className="size-5 items-center justify-center rounded-full bg-primary">
        <Text className="text-2xs font-medium text-primary-foreground">{getInitials(props.name)}</Text>
      </View>
    </IconButton>
    {props.blockedReason && <Text>{props.blockedReason}</Text>}
    {open && <Dialog open onOpenChange={setOpen}>
      <DialogContent testID="user-sheet" className={SIDE_SHEET}>
        {/* v2's sheet header (user-sheet.tsx:654-676): the cashier's Avatar at its default `xs` (size-5, text-2xs initials;
            avatar/index.tsx:42,76) beside the title and description; `pr-6` keeps them clear of the ×. */}
        <DialogHeader className="flex-row items-center gap-3 pr-6">
          <View testID="user-sheet-avatar" className="size-5 items-center justify-center rounded-full bg-primary">
            <Text className="text-2xs font-medium text-primary-foreground">{getInitials(props.name)}</Text>
          </View>
          <View className="min-w-0 flex-1">
            <DialogTitle numberOfLines={1}>{props.name}</DialogTitle>
            {props.storeName && <DialogDescription testID="user-sheet-description">{props.storeName}</DialogDescription>}
          </View>
        </DialogHeader>
        {/* v2's DialogContent close (dialog/index.tsx:213-233): an absolute h-ctl square at top-1 right-1, an 18 px glyph. */}
        <View className="absolute right-1 top-1">
          <IconButton variant="ghost" className="h-11 w-11" testID="user-sheet-close-x" accessibilityLabel="Close" onPress={() => setOpen(false)}><XIcon size={18} /></IconButton>
        </View>
        {/* v2's DialogBody (user-sheet.tsx:679) takes the height, so the links and the footer sit at the sheet's foot. */}
        <View className="flex-1 gap-4">
        {props.sales && <SalesTodayRow {...props.sales} />}
        {props.drawer && (props.onOpenDrawer ? <DrawerDoor drawer={props.drawer} disabled={Boolean(props.blockedReason)}
          onPress={() => { setOpen(false); props.onOpenDrawer!(); }} />
          : <View testID="user-sheet-drawer" className="flex-row items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <Text className="font-medium">In the drawer</Text>
            <Text className="text-lg font-semibold">{props.drawer.figure}</Text>
          </View>)}
        <View testID="user-sheet-switch-user">
          {/* v2's `caption` rank (user-sheet.tsx:703; text/ladder.ts:18): muted, text-xs, tracking-wide, uppercase. */}
          <View className="mt-2 h-10 flex-row items-center justify-between border-b border-border px-2.5"><Text className="text-xs uppercase tracking-wide text-muted-foreground">Hand the till to</Text></View>
        {props.cashiers.map(cashier => <View key={cashier.uuid} className="flex-row gap-2">
          <Button testID={`user-sheet-user-${cashier.uuid}`}
            onPress={() => { setOpen(false); props.onSwitch(cashier.uuid); }}><Text>{`Switch to ${cashier.name}`}</Text></Button>
          {props.onRemove && <Button testID={`user-sheet-remove-${cashier.uuid}`} accessibilityLabel={`Remove ${cashier.name}`}
            onPress={() => setRemoving(cashier)}><Text>Remove</Text></Button>}
        </View>)}
          {/* v2's compact AddUserButton (add-user-button.tsx:106-113): a quiet MenuRow (menu-row/index.tsx:69, min-h-row 44 px,
              accent wash) with a muted + at the default 18 px, not a filled button. */}
          <Pressable testID="user-sheet-another-account" role="button" onPress={() => { setOpen(false); props.onAddAnother(); }}
            className="min-h-11 w-full flex-row items-center gap-2 rounded-md px-2.5 py-1.5 web:hover:bg-accent active:bg-accent">
            <PlusIcon testID="user-sheet-another-account-icon" size={18} strokeWidth={1.5} className="text-muted-foreground" />
            <Text numberOfLines={1} className="min-w-0 flex-1 text-base text-foreground">Another account…</Text>
          </Pressable>
        </View>
        </View>
        {/* v2's foot (user-sheet.tsx:773-787): the open-external glyph (size sm, muted) before the `key` rank label.
            `-mx-6` takes the rule to the sheet's edges, as v2's, past the sheet's p-6. */}
        {props.adminUrl && <View testID="user-sheet-foot" className="-mx-6 flex-row items-center gap-4 border-t border-border px-4 py-2">
          <Pressable testID="user-sheet-wp-admin" role="link" className="flex-row items-center gap-1" onPress={() => { void Linking.openURL(props.adminUrl!); }}>
            <OpenExternalIcon testID="user-sheet-wp-admin-icon" size={16} strokeWidth={1.5} className="text-muted-foreground" />
            <Text className="text-sm text-muted-foreground">WordPress Admin</Text>
          </Pressable>
        </View>}
        {/* v2's DialogFooter (dialog/index.tsx:376-413; user-sheet.tsx:800-822): Sign out as the `destructive` slot, v2's
            `outline-destructive` (button/index.tsx:53, border-destructive bg-card, the label in the foreground ink), apart
            on the left, and the Close dismiss on the right; a full-width rule over pt-4. */}
        <View testID="user-sheet-footer" className="-mx-6 flex-row items-center justify-between border-t border-border px-4 pt-4">
          <Button variant="outline" testID="user-sheet-sign-out" className="h-11 border-destructive bg-card" onPress={() => { setOpen(false); props.onSignOut(); }}><Text>Sign out</Text></Button>
          <SheetCloseButton testID="user-sheet-close" onPress={() => setOpen(false)} />
        </View>
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
