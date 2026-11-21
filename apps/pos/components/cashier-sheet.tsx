import { useState } from 'react';
import type { JSX } from 'react';
import { Linking, Pressable, View } from 'react-native';
import type { RxCollection } from 'rxdb';
import type { PosOrder } from '@tallyui/pos';
import { useMoneyFormat } from '@tallyui/core';
import { Path } from 'react-native-svg';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, createSvgIcon, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, IconButton, Text, XIcon } from '@tallyui/components';
import { getInitials } from '../lib/cashier/initials';
import { sheetMoney, tillAgeLabel, tillSinceTime, useCashierSalesToday } from '../lib/cashier/sheet-figures';
import type { SalesTotal } from '../lib/cashier/sheet-figures';
import { useIsOnline } from '../lib/online/online-status';
import { useMinuteClock } from '../lib/reports/use-minute-clock';
import { SheetCloseButton } from './sheet';
import { OpenExternalIcon } from './docs-link';
import { PlusIcon } from './icons';

// v2's `register` glyph, the drawer door's (monorepo packages/components/src/icon/components/tabler/register.tsx:16-17).
const RegisterIcon = createSvgIcon('RegisterIcon', () => <>
  <Path d="M21 15h-2.5a1.503 1.503 0 0 0-1.5 1.5 1.503 1.503 0 0 0 1.5 1.5h1a1.503 1.503 0 0 1 1.5 1.5 1.503 1.503 0 0 1-1.5 1.5H17m2 0v1m0-8v1m-6 6H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2m12 3.12V9a2 2 0 0 0-2-2h-2" />
  <Path d="M16 10V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v6m8 0H8m8 0h1m-9 0H7m1 4v.01M8 17v.01m4-3.02V14m0 3v.01" />
</>);

// v2's right side sheet: full height, flush right, no rounding, a left border, on v2's `bg-card` surface
// (monorepo packages/components/src/dialog/index.tsx:199), white in Light, not the page's bg-background. `px-4`: v2's panel
// pads no side of its own; its header, body, foot and footer each sit 16 px in (dialog/index.tsx:243,277,384), not p-6's 24.
// `py-4`: v2's DialogContent pads 16 px top and bottom (dialog/index.tsx:199), which the user sheet keeps (user-sheet.tsx:632)
// and the right side adds nothing to (dialog/index.tsx:64), not p-6's 24. Last, so it wins over the dialog's p-6.
const SIDE_SHEET = 'left-auto right-0 top-0 h-full max-w-lg translate-x-0 translate-y-0 rounded-none border-0 border-l bg-card px-4 py-4';
// v2's labels are the `key` rank (user-sheet.tsx:209,685; text/ladder.ts:14), its figures `AmountFigure size="tile"`
// (user-sheet.tsx:163,686; amount-figure/index.tsx:18-20).
const KEY_LABEL = 'text-sm text-muted-foreground';
const TILE_FIGURE = 'text-xl font-bold tabular-nums';

function SheetDescription({ storeName, signedInAt }: { storeName?: string; signedInAt?: number }) {
  const now = useMinuteClock();
  const description = [storeName, signedInAt !== undefined && `since ${tillSinceTime(signedInAt)}`,
    signedInAt !== undefined && tillAgeLabel(signedInAt, now.getTime())].filter(Boolean).join(' · ');
  return description ? <DialogDescription testID="user-sheet-description">{description}</DialogDescription> : null;
}

function SalesTodayRow({ total, currency, locale }: {
  total: SalesTotal; currency: string; locale?: string;
}) {
  const format = useMoneyFormat();
  return <View testID="user-sheet-sales-today" className="flex-row items-center justify-between px-3 py-2.5">
    <Text testID="user-sheet-sales-today-label" className={KEY_LABEL}>Your sales today</Text>
    <Text className={TILE_FIGURE}>{sheetMoney(total.totalMinor, currency, locale, format)}</Text>
  </View>;
}

export interface SheetDrawer { figure: string; verbs: string; opener?: string; openerName?: string }

/** v2's DrawerDoor (packages/core/src/screens/main/pos/cart/user-sheet.tsx): the drawer tile over a row of its verbs. */
function DrawerDoor({ drawer, disabled, onPress }: { drawer: SheetDrawer; disabled?: boolean; onPress(): void }) {
  const { openerName } = drawer;
  // v2's DrawerDoor (user-sheet.tsx:199-205): a PressableSurface with no fill of its own, so it shows the sheet's bg-card,
  // with its border, radius and the accent press and hover wash (pressable-surface/index.tsx:28).
  return <Pressable testID="user-sheet-drawer" role="button" accessibilityLabel={`In the drawer, ${drawer.figure}`}
    onPress={onPress} disabled={disabled} className="rounded-lg border border-border active:bg-accent web:hover:bg-accent">
    <View className="flex-row items-center gap-3 px-3 py-2.5">
      {/* v2's `ToneDisc tone="muted" icon="register" size="sm"` (user-sheet.tsx:207; tone-disc/index.tsx:11,28-30;
          lib/tone.ts:53,55): a size-11 bg-muted disc, the glyph at the default 18 px (icon/index.tsx:27), muted. */}
      <View className="size-11 items-center justify-center rounded-full bg-muted">
        <RegisterIcon testID="user-sheet-drawer-icon" size={18} strokeWidth={1.5} className="text-muted-foreground" />
      </View>
      <View className="min-w-0 flex-1">
        <Text testID="user-sheet-drawer-label" className={KEY_LABEL}>In the drawer</Text>
        {/* v2's opener line (user-sheet.tsx:143-158): the `key` rank (text/ladder.ts:14), "opened {time} by" with no name
            (en/core.json:241), then the opener's Avatar `size="sm"`: size-7, text-2xs initials on bg-primary
            (avatar/index.tsx:43,53,77). The avatar carries the name, so a screen reader still says who opened it. */}
        {drawer.opener && <View className="flex-row items-center gap-1">
          <Text testID="user-sheet-drawer-opener" className="text-sm text-muted-foreground">{drawer.opener}</Text>
          {openerName && <View testID="user-sheet-drawer-opener-avatar" role="img" accessibilityLabel={openerName} className="size-7 items-center justify-center rounded-full bg-primary">
            <Text className="text-2xs font-medium text-primary-foreground">{getInitials(openerName)}</Text>
          </View>}
        </View>}
      </View>
      <Text testID="user-sheet-drawer-figure" className={TILE_FIGURE}>{drawer.figure}</Text>
    </View>
    <View testID="user-sheet-drawer-verbs" className="flex-row items-center justify-between border-t border-border px-3 py-2">
      {/* v2's `Text variant="link"` (user-sheet.tsx:218; text/ladder.ts:24,27): the foreground ink at text-base, regular
          weight, underlined on hover; only the chevron stays primary. */}
      <Text testID="user-sheet-drawer-verbs-text" className="text-base text-foreground web:hover:underline">{drawer.verbs}</Text>
      <Text className="text-primary">›</Text>
    </View>
  </Pressable>;
}

export interface CashierOption { uuid: string; name: string }
export function CashierSheet(props: {
  name: string;
  cashiers: CashierOption[];
  /** v2's usePaymentInFlight (user-sheet.tsx:498): the sheet still opens, but holds the hand-over, Sign out and the drawer door. */
  paying?: boolean;
  storeName?: string;
  signedInAt?: number;
  awaitingStore?: number;
  sales?: { orders: RxCollection<PosOrder>; cashierRef: string; currency: string; locale?: string } | null;
  drawer?: SheetDrawer;
  /** Given, the drawer block is v2's drawer door: pressing it closes the sheet and opens the register's drawer flows. */
  onOpenDrawer?: () => void;
  adminUrl?: string;
  /** The till's register while its session is open or counting: the hand-over says its drawer stays open. */
  drawerRegister?: string;
  onSwitch(uuid: string): void;
  onRemove?(uuid: string): void;
  onAddAnother(): void;
  onSignOut(): void;
  /** An open register asks to start its count before signing out. */
  openRegister?: { title: string; onClose(): Promise<boolean> };
}): JSX.Element {
  const online = useIsOnline();
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [removing, setRemoving] = useState<CashierOption | null>(null);
  const [handingTo, setHandingTo] = useState<CashierOption | null>(null);
  const n = props.awaitingStore ?? 0;
  // v2 user-sheet.tsx:496: counted while closed, so opening never flashes $0.00.
  const salesToday = useCashierSalesToday(props.sales?.orders, props.sales?.cashierRef ?? '', props.sales?.currency ?? '');
  return <>
    {/* v2's CashierEntry (packages/core/src/screens/main/components/cashier-entry/index.tsx:91-101): the initials avatar
        on the bar itself; v2's `wash="accent"` is a press and hover wash only (pressable-surface/index.tsx:28), not a fill.
        The ghost IconButton gives the press wash (active:bg-accent); it has no hover wash. */}
    <IconButton testID="register-bar-avatar" accessibilityLabel={props.name} className="rounded-lg" onPress={() => setOpen(true)}>
      {/* v2's Avatar default `xs`: `size-5`, 20 px, with `text-2xs` initials (monorepo packages/components/src/avatar/index.tsx:42,58,76). */}
      <View testID="register-bar-avatar-initials" className="size-5 items-center justify-center rounded-full bg-primary">
        <Text className="text-2xs font-medium text-primary-foreground">{getInitials(props.name)}</Text>
      </View>
    </IconButton>
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
            <SheetDescription storeName={props.storeName} signedInAt={props.signedInAt} />
          </View>
        </DialogHeader>
        {/* v2's DialogContent close (dialog/index.tsx:213-233): an absolute h-ctl square at top-1 right-1, an 18 px glyph. */}
        <View className="absolute right-1 top-1">
          <IconButton variant="ghost" className="h-11 w-11" testID="user-sheet-close-x" accessibilityLabel="Close" onPress={() => setOpen(false)}><XIcon size={18} /></IconButton>
        </View>
        {/* v2's DialogBody (user-sheet.tsx:679) takes the height, so the links and the footer sit at the sheet's foot;
            its `gap-0` stacks the sections flush, the band's `mt-2` the only space before "Hand the till to".
            DialogBody's base `py-1` (dialog/index.tsx:277) is the 4 px between the header and "Your sales today". */}
        <View testID="user-sheet-body" className="flex-1 gap-0 py-1">
        {props.sales && <SalesTodayRow total={salesToday} currency={props.sales.currency} locale={props.sales.locale} />}
        {props.drawer && (props.onOpenDrawer ? <DrawerDoor drawer={props.drawer} disabled={props.paying}
          onPress={() => { setOpen(false); props.onOpenDrawer!(); }} />
          : <View testID="user-sheet-drawer" className="flex-row items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <Text className={KEY_LABEL}>In the drawer</Text>
            <Text className={TILE_FIGURE}>{props.drawer.figure}</Text>
          </View>)}
        {/* v2 user-sheet.tsx:228-242; ADR 0040 rule 1: show sales awaiting the store. */}
        {n > 0 && <View testID="user-sheet-awaiting-store" role="alert" className="mt-2 rounded-lg border border-warning bg-warning/10 px-3 py-2.5">
          <Text testID="user-sheet-awaiting-store-title" className="font-medium text-foreground">{`Awaiting store · ${n === 1 ? '1 sale' : `${n} sales`}`}</Text>
          <Text className="text-muted-foreground">Sent when you are signed in online.</Text>
        </View>}
        {/* v2 user-sheet.tsx:694-700, `Notice tone="info"` (core.json register.finish_payment_first). No info notice in the
            app yet, so the awaiting-store band's shape with the info tokens. */}
        {props.paying && <View testID="user-sheet-hold" role="status" className="mt-2 rounded-lg border border-info bg-info/10 px-3 py-2.5">
          <Text testID="user-sheet-hold-title" className="font-medium text-foreground">Finish the payment first</Text>
        </View>}
        <View testID="user-sheet-switch-user">
          {/* v2's `caption` rank (user-sheet.tsx:703; text/ladder.ts:18): muted, text-xs, tracking-wide, uppercase, on an
              `h-band` row (user-sheet.tsx:702): seven spacing units, 28 px (apps/main/global.css:33). */}
          <View testID="user-sheet-switch-band" className="mt-2 h-7 flex-row items-center justify-between border-b border-border px-2.5"><Text className="text-xs uppercase tracking-wide text-muted-foreground">Hand the till to</Text></View>
        {/* v2's CashierRow (user-sheet.tsx:245-288): a quiet MenuRow (menu-row/index.tsx) led by the Avatar `md` (size-9,
            text-xs initials on bg-primary; avatar/index.tsx), the name its only label. Remove is the app's own, a ghost
            sibling, so no press nests inside a press. */}
        {props.cashiers.map(cashier => <View key={cashier.uuid} className="flex-row items-center gap-2">
          <Pressable testID={`user-sheet-user-${cashier.uuid}`} role="button" accessibilityLabel={cashier.name}
            disabled={props.paying} onPress={() => setHandingTo(cashier)}
            className="min-h-11 min-w-0 flex-1 flex-row items-center gap-2 rounded-md px-2.5 py-1.5 web:hover:bg-accent active:bg-accent">
            <View testID={`user-sheet-user-${cashier.uuid}-avatar`} className="size-9 items-center justify-center rounded-full bg-primary">
              <Text className="text-xs font-medium text-primary-foreground">{getInitials(cashier.name)}</Text>
            </View>
            <Text numberOfLines={1} className="min-w-0 flex-1 text-base text-foreground">{cashier.name}</Text>
          </Pressable>
          {props.onRemove && <Button variant="ghost" testID={`user-sheet-remove-${cashier.uuid}`} accessibilityLabel={`Remove ${cashier.name}`}
            disabled={props.paying} onPress={() => setRemoving(cashier)}><Text>Remove</Text></Button>}
        </View>)}
          {/* v2's compact AddUserButton (add-user-button.tsx:106-113): a quiet MenuRow (menu-row/index.tsx:69, min-h-row 44 px,
              accent wash) with a muted + at the default 18 px, not a filled button. Shown only under v2's `online && !paying` (user-sheet.tsx:720-722). */}
          {online && !props.paying && (
          <Pressable testID="user-sheet-another-account" role="button" onPress={() => { setOpen(false); props.onAddAnother(); }}
            className="min-h-11 w-full flex-row items-center gap-2 rounded-md px-2.5 py-1.5 web:hover:bg-accent active:bg-accent">
            <PlusIcon testID="user-sheet-another-account-icon" size={18} strokeWidth={1.5} className="text-muted-foreground" />
            <Text numberOfLines={1} className="min-w-0 flex-1 text-base text-foreground">Another account…</Text>
          </Pressable>
          )}
        </View>
        {/* v2's StoreRow (user-sheet.tsx:435-470,725-733): a PropertyRow under the users, off a phone one line, min-h-ctl
            gap-3 py-1, the `key` rank in a w-32 key column, then the name (property-row/index.tsx). One store, no Switch. */}
        {props.storeName && <View className="mt-2">
          <View testID="user-sheet-row-store" className="min-h-11 flex-row items-center gap-3 py-1">
            <View className="min-h-9 w-32 shrink-0 justify-center"><Text className={KEY_LABEL}>Store</Text></View>
            <Text className="min-w-0 flex-1 text-base text-foreground">{props.storeName}</Text>
          </View>
        </View>}
        </View>
        {/* v2's foot (user-sheet.tsx:773-787): the open-external glyph (size sm, muted) before the `key` rank label.
            `-mx-4` takes the rule to the sheet's edges, as v2's, past the sheet's px-4. */}
        {props.adminUrl && <View testID="user-sheet-foot" className="-mx-4 flex-row items-center gap-4 border-t border-border px-4 py-2">
          <Pressable testID="user-sheet-wp-admin" role="link" className="flex-row items-center gap-1" onPress={() => { void Linking.openURL(props.adminUrl!); }}>
            <OpenExternalIcon testID="user-sheet-wp-admin-icon" size={16} strokeWidth={1.5} className="text-muted-foreground" />
            <Text className="text-sm text-muted-foreground">WordPress Admin</Text>
          </Pressable>
        </View>}
        {/* v2's DialogFooter (dialog/index.tsx:376-413; user-sheet.tsx:800-822): Sign out as the `destructive` slot, v2's
            `outline-destructive` (button/index.tsx:53, border-destructive bg-card, the label in the foreground ink), apart
            on the left, and the Close dismiss on the right; a full-width rule over pt-4. */}
        <View testID="user-sheet-footer" className="-mx-4 flex-row items-center justify-between border-t border-border px-4 pt-4">
          <Button variant="outline" testID="user-sheet-sign-out" className="h-11 border-destructive bg-card" disabled={props.paying} onPress={() => { if (props.openRegister) { setAsking(true); } else { setOpen(false); props.onSignOut(); } }}><Text>Sign out</Text></Button>
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
    {/* v2 switch-confirm.tsx:134-140,171,274-300 (en/core.json register.hand_till_to, hand_over_reloads,
        drawer_stays_open_on, hand_over_to): a cashier row asks first; only the confirm switches, and a dismiss only
        clears the choice, so the Action's own onOpenChange(false) cannot switch a second time. */}
    {handingTo && <AlertDialog open onOpenChange={next => { if (!next) setHandingTo(null); }}>
      <AlertDialogContent testID="switch-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>{`Hand the till to ${handingTo.name}?`}</AlertDialogTitle>
          <AlertDialogDescription>{`The POS reloads as ${handingTo.name}.${props.drawerRegister ? ` The drawer stays open on ${props.drawerRegister}.` : ''}`}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild onPress={() => setHandingTo(null)}><Button variant="outline" testID="switch-confirm-cancel"><Text>Cancel</Text></Button></AlertDialogCancel>
          <AlertDialogAction asChild onPress={() => { const uuid = handingTo.uuid; setHandingTo(null); setOpen(false); props.onSwitch(uuid); }}>
            <Button testID="switch-confirm-confirm"><Text>{`Hand over to ${handingTo.name}`}</Text></Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>}
    {/* v2 switch-confirm.tsx:261-304: offer to close the register before signing out. */}
    {asking && props.openRegister && <AlertDialog open onOpenChange={next => { if (!next) setAsking(false); }}>
      <AlertDialogContent testID="sign-out-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>{props.openRegister.title}</AlertDialogTitle>
          <AlertDialogDescription>A till left open stays open for the next cashier. The closure records who closed it.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild onPress={() => setAsking(false)}><Button variant="outline" testID="sign-out-confirm-cancel"><Text>Cancel</Text></Button></AlertDialogCancel>
          <Button variant="outline" testID="sign-out-confirm-anyway" onPress={() => { setAsking(false); setOpen(false); props.onSignOut(); }}><Text>Sign out anyway</Text></Button>
          <AlertDialogAction asChild onPress={() => { const ask = props.openRegister!; setAsking(false); void ask.onClose().then(ok => { if (ok) setOpen(false); }); }}><Button testID="sign-out-confirm-close-register"><Text>Close register</Text></Button></AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>}
  </>;
}
