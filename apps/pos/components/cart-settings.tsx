import { useContext, useEffect, useState } from 'react';
import type { ComponentProps, JSX, ReactNode } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Path } from 'react-native-svg';
import type { RxCollection } from 'rxdb';
import { Cart, createSvgIcon, Dialog, DialogOverlay, DialogPortal, DialogTitle, IconButton, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, Text, XIcon } from '@tallyui/components';
import { Dialog as DialogPrimitive } from '@tallyui/primitives';
import { AppRailArea, AppRailShown, BESIDE_RAIL } from './app-rail';
import { ChevronDownIcon, FieldLabel, SELECT_FACE, SwitchRow } from './select-chevron';
import { useRegister } from '../lib/register/register-context';
import type { CustomerSource } from '../lib/customers/customer-source';
import { CartAddMenu } from './cart-add-menu';
import { CATALOGUE_VIEW_DEFAULTS } from '../lib/catalogue/catalogue-view-state';
import { RestoreDefaultsButton, SHEET_TITLE, SheetCloseButton } from './catalogue-display-options';
import type { PanelPosition } from '../lib/catalogue/catalogue-view-state';
import { CART_SETTINGS_DEFAULTS, isQuickDiscount, LINE_SORTS, normalizeLineSort, QUICK_DISCOUNT_SLOTS, sortCartLines, useCartSettings } from '../lib/sale/cart-settings';
import type { CartSettings } from '../lib/sale/cart-settings';
import { AutoPrintReceiptSetting } from './auto-print-setting';
import { RECEIPT_SETTINGS_DEFAULTS, saveReceiptSettings } from '../lib/receipts/receipt-settings';

// v2's UISettingsDialog trigger is the `filters` icon; in tabler, v2's default set, that is `adjustments-horizontal`.
const FiltersIcon = createSvgIcon('FiltersIcon', () => <>
  <Path d="M12 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0M4 6h8m4 0h4" />
  <Path d="M6 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0m-2 0h2m4 0h10" />
  <Path d="M15 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0M4 18h11m4 0h1" />
</>);

// v2's UISettingsDialog is a full-height `lg` (512px) side panel (dialog side="left": h-full rounded-none border-r).
const SHEET = 'fixed top-0 z-50 h-full w-[512px] max-w-full gap-4 border-border bg-card py-4 shadow-lg';
// v2 opens the panel in its screen's own overlay host, beside the rail (apps/main/app/(app)/(drawer)/_layout.tsx
// `Scene`), so the rail stays undimmed and usable and a left panel starts at its right edge; with no rail (a phone)
// the overlay and panel start at the window's.
// v2's scrim is `bg-scrim` (components lib/overlay/index.tsx:562), Light's `--scrim: oklch(0.2 0.01 262 / .28)`
// (apps/main/global.css:444): a near black at 28%, over TallyUI's `bg-black/80`. This app has no scrim token.
const SCRIM = 'bg-black/30';
const CART_SHEET: Record<PanelPosition, (railShown: boolean) => string> = {
  left: railShown => `${railShown ? BESIDE_RAIL : 'left-0'} right-auto border-r ${SHEET}`,
  right: () => `left-auto right-0 border-l ${SHEET}`,
};

/** A full-width two-cell segmented control, as v2's FormSegmentedControl draws it; the chosen cell is tinted. */
function SegmentedRow({ title, testID, cells }: {
  title: string; testID?: string; cells: { testID: string; label: string; selected: boolean; onPress(): void }[];
}): JSX.Element {
  return <View className="gap-1.5">
    <FieldLabel>{title}</FieldLabel>
    <View testID={testID} role="tablist" aria-label={title} className="min-h-11 flex-row overflow-hidden rounded-lg border border-border bg-card">
      {cells.map((cell, i) => <Pressable key={cell.testID} testID={cell.testID} role="tab" aria-selected={cell.selected} onPress={cell.onPress}
        className={'flex-1 items-center justify-center px-3 py-1.5 web:hover:bg-accent active:opacity-70'
          + (i > 0 ? ' border-l border-border' : '') + (cell.selected ? ' bg-primary/10' : '')}>
        <Text className={'text-base ' + (cell.selected ? 'text-primary' : 'text-foreground')}>{cell.label}</Text>
      </Pressable>)}
    </View>
  </View>;
}

export function CartSettingsDialog({ position, onPositionChange, settings, onSettingsChange }: {
  position: PanelPosition;                     // the PRODUCTS side (AppCatalogueViewState.position)
  onPositionChange(next: PanelPosition): void; // called with the products side
  settings: CartSettings;
  onSettingsChange(next: CartSettings): void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const register = useRegister();
  // Read here, not inside the portal: it renders at the root PortalHost, outside AppFrame's providers.
  const railShown = useContext(AppRailShown);
  const area = useContext(AppRailArea);
  // v2's sheet lives in its screen's overlay host and hides with the screen; this one portals to the root and the
  // sale screen stays mounted under a pushed area, so a rail tap that leaves the area closes it.
  useEffect(() => { setOpen(false); }, [area]);
  // v2's usePanelSide('cart') docks the cart's panels opposite the cart, so on the products side: `position`.
  const side = position;
  return <>
    {/* v2's IconButton: `size-ctl` 44 px, its default 18 px glyph muted (monorepo packages/components/src/icon-button/index.tsx:26,93). */}
    <IconButton testID="cart-settings-button" accessibilityLabel="Cart settings" className="h-11 w-11" onPress={() => setOpen(true)}>
      <FiltersIcon testID="cart-settings-button-icon" size={18} className="text-muted-foreground" />
    </IconButton>
    {/* DialogContent's overlay is a fixed inset-0 with no class option, which would dim the rail. Back to
        DialogContent if TallyUI adds an overlay className. */}
    {open && <Dialog open onOpenChange={next => { if (!next) setOpen(false); }}><DialogPortal>
      <DialogOverlay testID="cart-settings-overlay" className={`${SCRIM}${railShown && side === 'left' ? ` ${BESIDE_RAIL}` : ''}`} />
      <DialogPrimitive.Content testID="cart-settings" dataSet={{ side }} className={CART_SHEET[side](railShown)}>
        {/* v2's DialogHeader (dialog/index.tsx: pl-4 pr-ctl) holds only the title, its dialog rank 16 px leading-none;
            the close is an absolute h-ctl square at top-1 right-1, as on the product settings sheet. */}
        <View testID="cart-settings-header" className="pl-4 pr-11">
          <DialogTitle testID="cart-settings-title" className={SHEET_TITLE}>Cart Settings</DialogTitle>
        </View>
        <View testID="cart-settings-close-slot" className="absolute right-1 top-1">
          <IconButton variant="ghost" className="h-11 w-11" testID="cart-settings-x" accessibilityLabel="Close" onPress={() => setOpen(false)}><XIcon size={18} /></IconButton>
        </View>
        {/* v2's plain rows: VStack's gap-2 between fields (components vstack/index.tsx), FormItem's gap-1.5 inside one
            (form/common.tsx), no box around a field. */}
        <ScrollView className="flex-1" contentContainerClassName="gap-2 px-4 py-1">
          {/* Cart left puts the products on the right (v2 pos-columns: productsOnRight = cart position left). */}
          <SegmentedRow title="Panel position" testID="cart-setting-panel-position" cells={[
            { testID: 'cart-setting-panel-position-left', label: 'Cart left', selected: position === 'right', onPress: () => onPositionChange('right') },
            { testID: 'cart-setting-panel-position-right', label: 'Cart right', selected: position === 'left', onPress: () => onPositionChange('left') },
          ]} />
          <SegmentedRow title="Open orders position" cells={[
            { testID: 'cart-setting-open-orders-top', label: 'Top', selected: settings.openOrdersPosition === 'top',
              onPress: () => onSettingsChange({ ...settings, openOrdersPosition: 'top' }) },
            { testID: 'cart-setting-open-orders-bottom', label: 'Bottom', selected: settings.openOrdersPosition === 'bottom',
              onPress: () => onSettingsChange({ ...settings, openOrdersPosition: 'bottom' }) },
          ]} />
          {/* v2: a `gap-1` View round the FormSelect (label, then the select) and its `key` hint. */}
          <View testID="cart-sort-items-row" className="gap-1">
            <View className="gap-1.5">
              <FieldLabel>Sort items</FieldLabel>
              <Select value={{ value: settings.sortLines, label: LINE_SORTS.find(sort => sort.id === settings.sortLines)!.label }}
                onValueChange={option => { if (option) onSettingsChange({ ...settings, sortLines: normalizeLineSort(option.value) }); }}>
                <SelectTrigger testID="cart-sort-items" className={SELECT_FACE} chevron={false}>
                  <SelectValue />
                  <ChevronDownIcon testID="cart-sort-items-chevron" size={16} className="text-muted-foreground" />
                </SelectTrigger>
                <SelectContent><SelectGroup>
                  {LINE_SORTS.map(({ id, label }) => <SelectItem key={id} value={id} label={label}
                    testID={`cart-sort-items-option-${id}`}><Text>{label}</Text></SelectItem>)}
                </SelectGroup></SelectContent>
              </Select>
            </View>
            {/* v2's `Text variant="key"` (pos/cart/ui-settings-form.tsx:129), the `key` rank text-sm, 13 px
                (text/ladder.ts:14), not the 12 px `help` rank the Quick Discounts hint takes. */}
            <Text testID="cart-sort-items-hint" className="text-sm text-muted-foreground">Fees and shipping always stay last</Text>
          </View>
          {/* Remount on any key change, so the slots re-read the stored keys and a refusal clears. */}
          <QuickDiscountsSetting key={settings.quickDiscounts.join(',')} keys={settings.quickDiscounts}
            onChange={next => onSettingsChange({ ...settings, quickDiscounts: next })} />
          <AutoPrintReceiptSetting />
          {/* The register sessions switch, once under the cart and only with a register. v2 has no such row; it is
              drawn as v2's FormSwitch with a description (form/switch.tsx, as ui-settings-form.tsx's autoPrintReceipt):
              FormItem's gap-1.5, the switch and its muted label, then the help line under the row: FormDescription's
              `variant="help"` (form/common.tsx l.103), `text-muted-foreground text-xs`, 12 px (text/ladder.ts l.15). */}
          {register && <View testID="cart-setting-register-sessions-item" className="gap-1.5">
            <SwitchRow label="Register sessions" testID="cart-setting-register-sessions" accessibilityLabel="Use register sessions"
              checked={register.setting} onCheckedChange={register.setSetting} />
            <Text testID="cart-setting-register-sessions-hint" className="text-xs text-muted-foreground">
              A session starts with a counted float, records cash paid in and out, and closes with a count that shows any difference.</Text>
          </View>}
        </ScrollView>
        <View className="flex-row justify-between border-t border-border px-4 pt-4">
          <RestoreDefaultsButton testID="ui-settings-restore-defaults" onPress={() => {
            onPositionChange(CATALOGUE_VIEW_DEFAULTS.position);
            onSettingsChange(CART_SETTINGS_DEFAULTS);
            saveReceiptSettings(RECEIPT_SETTINGS_DEFAULTS);
          }} />
          <SheetCloseButton testID="ui-settings-close" onPress={() => setOpen(false)} />
        </View>
      </DialogPrimitive.Content>
    </DialogPortal></Dialog>}
  </>;
}

/** A slot's entry: `undefined` removes the slot (empty or 0), a number writes it, null is refused. */
function parseQuickDiscount(text: string): number | undefined | null {
  const raw = text.trim();
  const trimmed = raw.split(',').length === 2 ? raw.replace(',', '.') : raw;
  if (!trimmed) return undefined;
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (n === 0) return undefined;
  return isQuickDiscount(n) ? n : null;
}

/**
 * v2's Quick Discounts setting (pos/cart/quick-discount-keys.tsx): the price keypad's own key row, one slot per
 * quick key. Slot order is key order; an empty slot or 0 removes the key, and the blanks are dropped from what is written.
 */
function QuickDiscountsSetting({ keys, onChange }: { keys: readonly number[]; onChange(next: number[]): void }): JSX.Element {
  const [refused, setRefused] = useState<number | null>(null);
  const stored = (i: number) => keys[i] === undefined ? '' : String(keys[i]);
  const [drafts, setDrafts] = useState(() => Array.from({ length: QUICK_DISCOUNT_SLOTS }, (_, i) => stored(i)));
  // The slot being typed in. At rest a slot reads as v2's key (PriceKeypad rest="key": `−5%`, a blank `–`);
  // a refused entry stays on show until it is fixed, as v2's keypad stays open on a refusal.
  const [editing, setEditing] = useState<number | null>(null);
  const commit = (index: number) => {
    const parsed = parseQuickDiscount(drafts[index]);
    if (parsed === null) { setRefused(index); return; }
    setRefused(null);
    const next = Array.from({ length: QUICK_DISCOUNT_SLOTS }, (_, i) => i === index ? parsed : keys[i]);
    onChange(next.filter((key): key is number => key !== undefined));
  };
  const description = refused !== null ? 'Enter a percentage above 0 and up to 100'
    : keys.length ? 'As the cashier sees them on the price keypad. Tap a key to change it.'
      : 'No quick keys. The price keypad shows the digits only.';
  return <View className="gap-1.5">
    <FieldLabel>Quick Discounts</FieldLabel>
    <View testID="cart-setting-quick-discounts" className="h-12 flex-row overflow-hidden rounded-md border border-border bg-card">
      {drafts.map((draft, i) => {
        const typing = editing === i || refused === i;
        return <View key={i} className={i > 0 ? 'flex-1 border-l border-border' : 'flex-1'}>
          <TextInput testID={`cart-setting-quick-discount-${i}`} accessibilityLabel={`Quick discount ${i + 1}`}
            keyboardType="numeric" aria-invalid={refused === i} placeholder="–"
            value={typing ? draft : keys[i] === undefined ? '' : `−${keys[i]}%`}
            onFocus={() => { if (refused !== i) setDrafts(prev => prev.map((d, j) => j === i ? stored(i) : d)); setEditing(i); }}
            onChangeText={text => { setEditing(i); setDrafts(prev => prev.map((d, j) => j === i ? text : d)); }}
            onBlur={() => { setEditing(null); commit(i); }} onSubmitEditing={() => commit(i)}
            // v2's quick key text: `font-semibold`, `text-sm` (13 px) for a quick key and a blank slot alike
            // (components keypad/index.tsx:53-56, price-keypad/index.tsx:196).
            className={'h-full min-w-0 px-3 text-center text-sm font-semibold ' + (typing ? 'text-foreground' : 'text-primary placeholder:text-muted-foreground')} />
        </View>;
      })}
    </View>
    {/* v2's FormDescription, the `help` rank: text-xs, 12 px (quick-discount-keys.tsx:80, text/ladder.ts:15). */}
    <Text testID="cart-setting-quick-discounts-hint" role={refused !== null ? 'alert' : undefined}
      className={`text-xs ${refused !== null ? 'text-destructive' : 'text-muted-foreground'}`}>{description}</Text>
  </View>;
}

export type CartWithSettingsProps = ComponentProps<typeof Cart> & {
  position: PanelPosition;
  onPositionChange(next: PanelPosition): void;
  openOrders?: ReactNode; // the open-order tab strip, placed by settings.openOrdersPosition
  coupons?: RxCollection | null; // the synced coupons for the + menu's Coupon side
  couponsOffered?: boolean;      // the sale screen's coupon gate
  customer?: ReactNode;          // the customer label and chip, at the head row's start
  customers?: CustomerSource | null;     // for the + menu's Add new customer
  createCustomersBlockedReason?: string; // why Add new customer is disabled
};

export function CartWithSettings({ position, onPositionChange, openOrders, coupons = null, couponsOffered = false, customer, customers = null,
  createCustomersBlockedReason, sale, ...cartProps }: CartWithSettingsProps): JSX.Element {
  const [settings, setSettings] = useCartSettings();
  const openOrdersStrip = <View testID="cart-open-orders">{openOrders}</View>;
  return <>
    {settings.openOrdersPosition === 'top' && openOrdersStrip}
    {/* The cart's head row: v2's cart header (pos/cart/cart-header.tsx), the customer first (it shrinks, so a long
        name never pushes the icons off the row), then the + menu and the Cart Settings icon. */}
    <View testID="cart-head" className="flex-row items-center gap-1">
      <View className="min-w-0 flex-1">{customer}</View>
      <CartAddMenu sale={sale} taxClasses={cartProps.taxClasses} coupons={coupons} couponsOffered={couponsOffered}
        customers={customers} createCustomersBlockedReason={createCustomersBlockedReason} />
      <CartSettingsDialog position={position} onPositionChange={onPositionChange} settings={settings} onSettingsChange={setSettings} />
    </View>
    {/* Sort a copy for display only: the order builder's lineItems keep the add order (receipts, parking, the order). */}
    <Cart {...cartProps} quickDiscounts={settings.quickDiscounts} sale={{ ...sale, order: { ...sale.order, lineItems: sortCartLines(sale.order.lineItems, settings.sortLines) } }} />
    {settings.openOrdersPosition !== 'top' && openOrdersStrip}
  </>;
}
