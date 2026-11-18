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
import { BoxIcon } from './icons';

const PlusIcon = createSvgIcon('PlusIcon', () => <><Path d="M5 12h14" /><Path d="M12 5v14" /></>);
// v2's tabler addCustomer, invoice, tag and shipping glyphs, drawn at stroke 1.5 (monorepo components/src/icon/components/tabler/<name>.tsx).
const AddCustomerIcon = createSvgIcon('AddCustomerIcon', () => <Path d="M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0m8 12h6m-3-3v6M6 21v-2a4 4 0 0 1 4-4h4" />);
const InvoiceIcon = createSvgIcon('InvoiceIcon', () => <><Path d="M14 3v4a1 1 0 0 0 1 1h4" />
  <Path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2M9 7h1m-1 6h6m-2 4h2" /></>);
const TagIcon = createSvgIcon('TagIcon', () => <><Path d="M6.5 7.5a1 1 0 1 0 2 0 1 1 0 1 0-2 0" />
  <Path d="M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592-5.592a2.41 2.41 0 0 0 0-3.408l-7.71-7.71A2 2 0 0 0 11.172 3H6a3 3 0 0 0-3 3" /></>);
const ShippingIcon = createSvgIcon('ShippingIcon', () => <><Path d="M5 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0m10 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0" />
  <Path d="M5 17H3V6a1 1 0 0 1 1-1h9v12m-4 0h6m4 0h2v-6h-8m0-5h5l3 5" /></>);
// v2's menu icon: 18 px in the row's text-foreground, gap-2 before the label (components/src/icon/index.tsx:27, menu-row/index.tsx:60,69).
const ICON = { size: 18, strokeWidth: 1.5, className: 'text-foreground' } as const;

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
        {/* v2 menu-add-customer: first, then a separator; disabled with the reason when the cashier cannot create.
            Each item leads with v2's icon (pos/cart/add-cart-items-menu.tsx:54-95). */}
        {customers && <>
          <DropdownMenuItem testID="cart-add-menu-customer" disabled={createCustomersBlockedReason !== undefined}
            onPress={() => setDialog('customer')} className="items-start gap-2">
            <AddCustomerIcon testID="cart-add-menu-customer-icon" {...ICON} className="mt-px text-foreground" />
            <View>
              <Text>Add new customer</Text>
              {createCustomersBlockedReason !== undefined
                ? <Text className="text-xs text-muted-foreground">{createCustomersBlockedReason}</Text> : null}
            </View>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>}
        {/* v2 pos/cart/add-cart-items-menu.tsx order: miscellaneous product, fee, discount, shipping. */}
        {chargesOffered && <DropdownMenuItem testID="cart-add-menu-misc-product" onPress={() => setDialog('misc-product')} className="gap-2">
          <BoxIcon testID="cart-add-menu-misc-product-icon" {...ICON} /><Text>Add Miscellaneous Product</Text></DropdownMenuItem>}
        {chargesOffered && <DropdownMenuItem testID="cart-add-menu-fee" onPress={() => setDialog('fee')} className="gap-2">
          <InvoiceIcon testID="cart-add-menu-fee-icon" {...ICON} /><Text>Add Fee</Text></DropdownMenuItem>}
        <DropdownMenuItem testID="cart-add-menu-discount" onPress={() => { setKind('quick'); setDialog('discount'); }} className="gap-2">
          <TagIcon testID="cart-add-menu-discount-icon" {...ICON} /><Text>Add Discount</Text></DropdownMenuItem>
        {chargesOffered && <DropdownMenuItem testID="cart-add-menu-shipping" onPress={() => setDialog('shipping')} className="gap-2">
          <ShippingIcon testID="cart-add-menu-shipping-icon" {...ICON} /><Text>Add Shipping</Text></DropdownMenuItem>}
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
        <DialogHeader><DialogTitle>Add Discount</DialogTitle></DialogHeader>
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
