import { useState } from 'react';
import type { ComponentProps, JSX, ReactNode } from 'react';
import { TextInput, View } from 'react-native';
import { Path } from 'react-native-svg';
import type { RxCollection } from 'rxdb';
import { Button, Cart, createSvgIcon, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, IconButton, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, SettingsGroup, Text } from '@tallyui/components';
import { useRegister } from '../lib/register/register-context';
import { CartAddMenu } from './cart-add-menu';
import { RegisterSwitch } from './register-controls';
import { CATALOGUE_VIEW_DEFAULTS } from '../lib/catalogue/catalogue-view-state';
import type { PanelPosition } from '../lib/catalogue/catalogue-view-state';
import { CART_SETTINGS_DEFAULTS, isQuickDiscount, LINE_SORTS, normalizeLineSort, QUICK_DISCOUNT_SLOTS, sortCartLines, useCartSettings } from '../lib/sale/cart-settings';
import type { CartSettings } from '../lib/sale/cart-settings';
import { AutoPrintReceiptSetting } from './auto-print-setting';
import { RECEIPT_SETTINGS_DEFAULTS, saveReceiptSettings } from '../lib/receipts/receipt-settings';

const SettingsIcon = createSvgIcon('SettingsIcon', () => <>
  <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
  <Path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
</>);

export function CartSettingsDialog({ position, onPositionChange, settings, onSettingsChange }: {
  position: PanelPosition;                     // the PRODUCTS side (AppCatalogueViewState.position)
  onPositionChange(next: PanelPosition): void; // called with the products side
  settings: CartSettings;
  onSettingsChange(next: CartSettings): void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const register = useRegister();
  return <>
    <IconButton testID="cart-settings-button" accessibilityLabel="Cart settings" onPress={() => setOpen(true)}><SettingsIcon size={20} /></IconButton>
    {open && <Dialog open onOpenChange={next => { if (!next) setOpen(false); }}>
      <DialogContent testID="cart-settings">
        <DialogHeader><DialogTitle>Cart Settings</DialogTitle></DialogHeader>
        <SettingsGroup title="Panel position">
          {/* Cart left puts the products on the right (v2 pos-columns: productsOnRight = cart position left). */}
          <View testID="cart-setting-panel-position" className="flex-row gap-4">
            <Button testID="cart-setting-panel-position-left" variant={position === 'right' ? 'default' : 'outline'}
              aria-selected={position === 'right'}
              onPress={() => onPositionChange('right')}><Text>Cart left</Text></Button>
            <Button testID="cart-setting-panel-position-right" variant={position === 'left' ? 'default' : 'outline'}
              aria-selected={position === 'left'}
              onPress={() => onPositionChange('left')}><Text>Cart right</Text></Button>
          </View>
        </SettingsGroup>
        <SettingsGroup title="Open orders position">
          <View className="flex-row gap-4">
            <Button testID="cart-setting-open-orders-top" variant={settings.openOrdersPosition === 'top' ? 'default' : 'outline'}
              aria-selected={settings.openOrdersPosition === 'top'}
              onPress={() => onSettingsChange({ ...settings, openOrdersPosition: 'top' })}><Text>Top</Text></Button>
            <Button testID="cart-setting-open-orders-bottom" variant={settings.openOrdersPosition === 'bottom' ? 'default' : 'outline'}
              aria-selected={settings.openOrdersPosition === 'bottom'}
              onPress={() => onSettingsChange({ ...settings, openOrdersPosition: 'bottom' })}><Text>Bottom</Text></Button>
          </View>
        </SettingsGroup>
        <SettingsGroup title="Sort items">
          <Select value={{ value: settings.sortLines, label: LINE_SORTS.find(sort => sort.id === settings.sortLines)!.label }}
            onValueChange={option => { if (option) onSettingsChange({ ...settings, sortLines: normalizeLineSort(option.value) }); }}>
            <SelectTrigger testID="cart-sort-items"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>
              {LINE_SORTS.map(({ id, label }) => <SelectItem key={id} value={id} label={label}
                testID={`cart-sort-items-option-${id}`}><Text>{label}</Text></SelectItem>)}
            </SelectGroup></SelectContent>
          </Select>
          <Text testID="cart-sort-items-hint" className="text-sm text-muted-foreground">Fees and shipping always stay last</Text>
        </SettingsGroup>
        {/* Remount on any key change, so the slots re-read the stored keys and a refusal clears. */}
        <QuickDiscountsSetting key={settings.quickDiscounts.join(',')} keys={settings.quickDiscounts}
          onChange={next => onSettingsChange({ ...settings, quickDiscounts: next })} />
        <AutoPrintReceiptSetting />
        {/* The register sessions switch, once under the cart; RegisterSwitch renders nothing without a register. */}
        {register && <SettingsGroup title="Register sessions"><RegisterSwitch /></SettingsGroup>}
        <DialogFooter>
          <Button testID="ui-settings-restore-defaults" variant="destructive" onPress={() => {
            onPositionChange(CATALOGUE_VIEW_DEFAULTS.position);
            onSettingsChange(CART_SETTINGS_DEFAULTS);
            saveReceiptSettings(RECEIPT_SETTINGS_DEFAULTS);
          }}><Text>Restore Default Settings</Text></Button>
          <Button testID="ui-settings-close" onPress={() => setOpen(false)}><Text>Close</Text></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>}
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
  const [drafts, setDrafts] = useState(() => Array.from({ length: QUICK_DISCOUNT_SLOTS }, (_, i) => keys[i] === undefined ? '' : String(keys[i])));
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
  return <SettingsGroup title="Quick Discounts">
    <View testID="cart-setting-quick-discounts" className="m-2 h-12 flex-row overflow-hidden rounded-md border border-border bg-card">
      {drafts.map((draft, i) => <View key={i} className={i > 0 ? 'flex-1 border-l border-border' : 'flex-1'}>
        <TextInput testID={`cart-setting-quick-discount-${i}`} accessibilityLabel={`Quick discount ${i + 1}`}
          keyboardType="numeric" aria-invalid={refused === i} value={draft}
          onChangeText={text => setDrafts(prev => prev.map((d, j) => j === i ? text : d))}
          onBlur={() => commit(i)} onSubmitEditing={() => commit(i)}
          className="h-full min-w-0 px-3 text-center text-foreground" />
      </View>)}
    </View>
    <Text testID="cart-setting-quick-discounts-hint" role={refused !== null ? 'alert' : undefined}
      className={`px-3 pb-2 text-sm ${refused !== null ? 'text-destructive' : 'text-muted-foreground'}`}>{description}</Text>
  </SettingsGroup>;
}

export type CartWithSettingsProps = ComponentProps<typeof Cart> & {
  position: PanelPosition;
  onPositionChange(next: PanelPosition): void;
  openOrders?: ReactNode; // the open-order tab strip, placed by settings.openOrdersPosition
  coupons?: RxCollection | null; // the synced coupons for the + menu's Coupon side
  couponsOffered?: boolean;      // the sale screen's coupon gate
};

export function CartWithSettings({ position, onPositionChange, openOrders, coupons = null, couponsOffered = false, sale, ...cartProps }: CartWithSettingsProps): JSX.Element {
  const [settings, setSettings] = useCartSettings();
  const openOrdersStrip = <View testID="cart-open-orders">{openOrders}</View>;
  return <>
    {settings.openOrdersPosition === 'top' && openOrdersStrip}
    {/* The cart's head row: v2's cart header (pos/cart/cart-header.tsx) ends with the + menu and the Cart Settings icon. */}
    <View testID="cart-head" className="flex-row items-center justify-end gap-1">
      <CartAddMenu sale={sale} taxClasses={cartProps.taxClasses} coupons={coupons} couponsOffered={couponsOffered} />
      <CartSettingsDialog position={position} onPositionChange={onPositionChange} settings={settings} onSettingsChange={setSettings} />
    </View>
    {/* Sort a copy for display only: the order builder's lineItems keep the add order (receipts, parking, the order). */}
    <Cart {...cartProps} quickDiscounts={settings.quickDiscounts} sale={{ ...sale, order: { ...sale.order, lineItems: sortCartLines(sale.order.lineItems, settings.sortLines) } }} />
    {settings.openOrdersPosition !== 'top' && openOrdersStrip}
  </>;
}
