// v2's cart "+" menu (WCPOS monorepo `packages/core/src/screens/main/pos/cart/add-cart-items-menu.tsx`) lists
// Add Miscellaneous Product, Add Fee, Add Discount and Add Shipping, each opening its own dialog.
import { useState } from 'react';
import type { ComponentProps, JSX } from 'react';
import { View } from 'react-native';
import { Path } from 'react-native-svg';
import type { RxCollection } from 'rxdb';
import { Cart, ChargeForm, createSvgIcon, Dialog, DialogContent, DialogHeader, DialogTitle, DiscountForm, DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, IconButton, Text, ToggleGroup, ToggleGroupItem } from '@tallyui/components';
import type { CustomerSource } from '../lib/customers/customer-source';
import { AddCustomerDialog } from './add-customer-dialog';
import { CouponPicker } from './coupon-entry';

const PlusIcon = createSvgIcon('PlusIcon', () => <><Path d="M5 12h14" /><Path d="M12 5v14" /></>);

type CartProps = ComponentProps<typeof Cart>;

export function CartAddMenu({ sale, taxClasses, coupons, couponsOffered, customers = null, createCustomersBlockedReason }: {
  sale: CartProps['sale'];
  taxClasses?: CartProps['taxClasses'];
  coupons: RxCollection | null; // the synced coupons, when the app has them
  couponsOffered: boolean;      // the sale screen's coupon gate
  customers?: CustomerSource | null;     // the store's customers; without them there is no Add new customer
  createCustomersBlockedReason?: string; // why the cashier cannot create customers (v2's capability tooltip)
}): JSX.Element {
  const [dialog, setDialog] = useState<'customer' | 'misc-product' | 'fee' | 'shipping' | 'discount' | null>(null);
  const [kind, setKind] = useState<'quick' | 'coupon'>('quick');
  const close = () => setDialog(null);
  const onOpenChange = (open: boolean) => { if (!open) close(); };
  // The Cart's own rule for its Add charge control (chargesOffered).
  const chargesOffered = (sale.capabilities?.orderCreate ?? 0) >= 5;
  const couponCollection = couponsOffered && coupons ? coupons : null;
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* v2's IconButton `plus` (pos/cart/add-cart-items-menu.tsx:47): `size-ctl` 44 px with the default glyph, 18 px
            (`size-4.5`) in text-muted-foreground (monorepo packages/components/src/icon-button/index.tsx:26,93; icon/index.tsx:27). */}
        <IconButton testID="cart-add-menu" accessibilityLabel="Add to cart" className="h-11 w-11">
          <PlusIcon testID="cart-add-menu-icon" size={18} className="text-muted-foreground" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* v2 menu-add-customer: first, then a separator; disabled with the reason when the cashier cannot create. */}
        {customers && <>
          <DropdownMenuItem testID="cart-add-menu-customer" disabled={createCustomersBlockedReason !== undefined}
            onPress={() => setDialog('customer')}>
            <View>
              <Text>Add new customer</Text>
              {createCustomersBlockedReason !== undefined
                ? <Text className="text-xs text-muted-foreground">{createCustomersBlockedReason}</Text> : null}
            </View>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>}
        {/* v2 pos/cart/add-cart-items-menu.tsx order: miscellaneous product, fee, discount, shipping. */}
        {chargesOffered && <DropdownMenuItem testID="cart-add-menu-misc-product" onPress={() => setDialog('misc-product')}>
          <Text>Add Miscellaneous Product</Text></DropdownMenuItem>}
        {chargesOffered && <DropdownMenuItem testID="cart-add-menu-fee" onPress={() => setDialog('fee')}>
          <Text>Add Fee</Text></DropdownMenuItem>}
        <DropdownMenuItem testID="cart-add-menu-discount" disabled={!sale.order.lineItems.length}
          onPress={() => { setKind('quick'); setDialog('discount'); }}><Text>Add Discount</Text></DropdownMenuItem>
        {chargesOffered && <DropdownMenuItem testID="cart-add-menu-shipping" onPress={() => setDialog('shipping')}>
          <Text>Add Shipping</Text></DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
    {dialog === 'customer' && customers && <AddCustomerDialog source={customers} onClose={close} onCreated={sale.setCustomer} />}
    {(dialog === 'misc-product' || dialog === 'fee' || dialog === 'shipping') && <Dialog open onOpenChange={onOpenChange}>
      <DialogContent testID={`add-${dialog}-dialog`} className="w-full max-w-lg">
        {/* Wired as the Cart wires its own ChargeForm. */}
        <ChargeForm kind={dialog === 'misc-product' ? 'custom' : dialog} currency={sale.order.currency} lineTax={sale.capabilities?.lineTax} taxClasses={taxClasses}
          shippingTaxFromStore={sale.capabilities?.taxRounding?.granularity === 'woocommerce'} onClose={close}
          onApply={({ kind: chargeKind, name, amountMinor, taxStatus, taxClass }) => {
            const result = chargeKind === 'custom' ? sale.addCustomLine({ name, priceMinor: amountMinor, taxStatus, taxClass })
              : chargeKind === 'fee' ? sale.addFee({ name, amountMinor, taxStatus, taxClass })
                : sale.addShipping({ name, amountMinor, taxStatus, taxClass });
            return typeof result === 'string' ? result : null;
          }} />
      </DialogContent>
    </Dialog>}
    {dialog === 'discount' && <Dialog open onOpenChange={onOpenChange}>
      <DialogContent testID="add-discount-dialog" className="w-full max-w-lg">
        <DialogHeader><DialogTitle>Add discount</DialogTitle></DialogHeader>
        {couponCollection && <ToggleGroup type="single" value={kind} variant="outline"
          onValueChange={value => { if (value === 'quick' || value === 'coupon') setKind(value); }}>
          {/* Toggle's own pressed style, which ToggleGroupItem leaves out. */}
          <ToggleGroupItem value="quick" testID="add-discount-kind-quick" className={kind === 'quick' ? 'bg-accent' : undefined}>
            <Text>Quick discount</Text></ToggleGroupItem>
          <ToggleGroupItem value="coupon" testID="add-discount-kind-coupon" className={kind === 'coupon' ? 'bg-accent' : undefined}>
            <Text>Coupon</Text></ToggleGroupItem>
        </ToggleGroup>}
        {couponCollection && kind === 'coupon'
          ? <CouponPicker sale={sale} coupons={couponCollection} currency={sale.order.currency} onClose={close} />
          : <DiscountForm title="Order discount" currency={sale.order.currency} onClose={close}
            onApply={discount => sale.applyDiscount(null, discount)} />}
      </DialogContent>
    </Dialog>}
  </>;
}
