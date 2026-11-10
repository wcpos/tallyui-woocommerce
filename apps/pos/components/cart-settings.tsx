import { useState } from 'react';
import type { ComponentProps, JSX, ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Cart, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, SettingsGroup, Text } from '@tallyui/components';
import { CATALOGUE_VIEW_DEFAULTS } from '../lib/catalogue/catalogue-view-state';
import type { PanelPosition } from '../lib/catalogue/catalogue-view-state';
import { CART_SETTINGS_DEFAULTS, LINE_SORTS, normalizeLineSort, sortCartLines, useCartSettings } from '../lib/sale/cart-settings';
import type { CartSettings } from '../lib/sale/cart-settings';
import { AutoPrintReceiptSetting } from './auto-print-setting';
import { RECEIPT_SETTINGS_DEFAULTS, saveReceiptSettings } from '../lib/receipts/receipt-settings';

export function CartSettingsDialog({ position, onPositionChange, settings, onSettingsChange }: {
  position: PanelPosition;                     // the PRODUCTS side (AppCatalogueViewState.position)
  onPositionChange(next: PanelPosition): void; // called with the products side
  settings: CartSettings;
  onSettingsChange(next: CartSettings): void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  return <>
    <Button testID="cart-settings-button" variant="outline" onPress={() => setOpen(true)}><Text>Cart Settings</Text></Button>
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
        <AutoPrintReceiptSetting />
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

export type CartWithSettingsProps = ComponentProps<typeof Cart> & {
  position: PanelPosition;
  onPositionChange(next: PanelPosition): void;
  openOrders?: ReactNode; // the open-order tab strip, placed by settings.openOrdersPosition
};

export function CartWithSettings({ position, onPositionChange, openOrders, sale, ...cartProps }: CartWithSettingsProps): JSX.Element {
  const [settings, setSettings] = useCartSettings();
  const openOrdersStrip = <View testID="cart-open-orders">{openOrders}</View>;
  return <>
    {settings.openOrdersPosition === 'top' && openOrdersStrip}
    {/* The cart's head row: v2 opens Cart Settings from the cart header (pos/cart/cart-header.tsx). */}
    <View testID="cart-head" className="flex-row justify-end">
      <CartSettingsDialog position={position} onPositionChange={onPositionChange} settings={settings} onSettingsChange={setSettings} />
    </View>
    {/* Sort a copy for display only: the order builder's lineItems keep the add order (receipts, parking, the order). */}
    <Cart {...cartProps} sale={{ ...sale, order: { ...sale.order, lineItems: sortCartLines(sale.order.lineItems, settings.sortLines) } }} />
    {settings.openOrdersPosition !== 'top' && openOrdersStrip}
  </>;
}
