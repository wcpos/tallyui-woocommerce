import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { RxCollection } from 'rxdb';
import { moneyFromDecimalString, useFormatMoney } from '@tallyui/core';
import { Button, DialogFooter, Input, Text, XIcon } from '@tallyui/components';
import type { useSale } from '@tallyui/pos';
import { toast } from '../lib/toast/toast';
import { cartLogger } from '../lib/sale/cart-log';
import { chipToneClassName } from './catalogue-filter-chips';
import { DiscountIcon } from './icons';

const typeLabels: Record<string, string> = {
  percent: 'Percentage discount', fixed_cart: 'Fixed cart discount', fixed_product: 'Fixed product discount',
};

interface CouponDoc { code: string; status?: string; amount?: string; discount_type?: string; description?: string }

/** The store-format formatter a component binds with useFormatMoney(). */
type FormatMoney = ReturnType<typeof useFormatMoney>;

function couponAmount(coupon: CouponDoc, currency: string, formatMoney: FormatMoney): string {
  const amount = coupon.amount ?? '';
  if (coupon.discount_type === 'percent') return `${Number(amount)}%`;
  const money = moneyFromDecimalString(amount, currency);
  return (money && formatMoney(money)) ?? amount;
}

// WCPOS v2's applied coupons (cart/totals.tsx:120-150): one row per coupon under the cart's Subtotal, a sm Chip
// (discount icon, code, a close clear at its right edge; chip/index.tsx:152-166) and the negative discount.
export function CouponRows({ sale }: { sale: ReturnType<typeof useSale> }): JSX.Element | null {
  const formatMoney = useFormatMoney();
  const applied = sale.order.display.coupons ?? [];
  if (!applied.length) return null;
  const minus = (amountMinor: number) => `−${formatMoney({ amount: amountMinor, currency: sale.order.currency }) ?? amountMinor}`;
  return (
    <>
      {applied.map(coupon => (
        <View key={coupon.code} testID={`coupon-chip-${coupon.code}`} className="flex-row items-center justify-between">
          <View className={`h-8 flex-row items-center gap-1.5 self-start rounded-full border pl-2.5 ${chipToneClassName(false)}`}>
            <DiscountIcon testID={`coupon-chip-icon-${coupon.code}`} size={16} strokeWidth={1.5} className="text-muted-foreground" />
            <Text className="text-sm text-foreground">{coupon.code}</Text>
            <Pressable testID={`remove-coupon-${coupon.code}`} role="button" accessibilityLabel={`Remove coupon ${coupon.code}`}
              className="-my-px min-w-8 items-center justify-center self-stretch" onPress={() => {
                const refusal = sale.removeCoupon(coupon.code);
                toast(refusal === null ? { type: 'info', title: 'Coupon removed' } : { type: 'warning', title: refusal });
              }}><XIcon size={14} className="text-muted-foreground" /></Pressable>
          </View>
          <Text className="text-sm">{minus(coupon.amountMinor)}</Text>
        </View>
      ))}
    </>
  );
}

// WCPOS v2's coupon picker over the synced coupons (no free-text code entry), the Coupon side of the cart's
// Add discount dialog (v2 add-discount-sheet.tsx). The host dialog unmounts it on close, which clears its state.
export function CouponPicker({ sale, coupons, currency, onClose }: {
  sale: ReturnType<typeof useSale>; coupons: RxCollection; currency: string; onClose(): void;
}): JSX.Element {
  const formatMoney = useFormatMoney();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [docs, setDocs] = useState<CouponDoc[]>([]);

  useEffect(() => {
    const subscription = coupons.find({ sort: [{ code: 'asc' }] }).$.subscribe(found => {
      setDocs(found.map(doc => doc.toJSON() as CouponDoc).filter(doc => doc.status === 'publish'));
    });
    return () => subscription.unsubscribe();
  }, [coupons]);

  const needle = search.trim().toLowerCase();
  const listed = needle ? docs.filter(doc => doc.code.toLowerCase().includes(needle)
    || (doc.description ?? '').toLowerCase().includes(needle)) : docs;

  async function apply() {
    if (!selected) return;
    const coupon = docs.find(doc => doc.code === selected);
    // v2's pos_cart.coupon_type_unsupported (#3494): the store records a 0 discount for these types
    // and never reduces the credit, so they are refused, not applied.
    if (!Object.prototype.hasOwnProperty.call(typeLabels, coupon?.discount_type ?? '')) {
      setError(
        `${selected} can't be applied in the POS: its coupon type (${coupon?.discount_type ?? 'unknown'}) comes from another plugin. Only percentage and fixed discount coupons are supported.`,
      );
      return;
    }
    setApplying(true);
    const refusal = await sale.applyCoupon(selected);
    setApplying(false);
    if (refusal === null) { cartLogger.info('Coupon applied', { code: selected }); onClose(); }
    else setError(refusal);
  }

  return (
    <View className="gap-2 py-2">
      {/* v2 add-coupon.tsx:88-90 places the error above the coupon field. */}
      {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
      <Input><Input.Field value={search} onChangeText={text => { setSearch(text); setError(null); }} placeholder="Search coupons..."
        accessibilityLabel="Search coupons" autoCapitalize="none" /></Input>
      <Text className="text-muted-foreground">{selected ?? 'Select coupon...'}</Text>
      <ScrollView style={{ maxHeight: 320 }}>
        {listed.length ? listed.map(coupon => (
          <Pressable key={coupon.code} accessibilityRole="button" accessibilityLabel={coupon.code}
            // react-native-web reads aria-selected, not accessibilityState.
            accessibilityState={{ selected: selected === coupon.code }} aria-selected={selected === coupon.code} onPress={() => { setSelected(coupon.code); setError(null); }}
            className={`flex-row items-center justify-between gap-2 rounded-md border border-border px-3 py-2 ${selected === coupon.code ? 'bg-accent' : 'bg-card'}`}>
            <View className="flex-1">
              <Text className="text-foreground">{coupon.code}</Text>
              <Text className="text-muted-foreground">{coupon.description || typeLabels[coupon.discount_type ?? ''] || ''}</Text>
            </View>
            <Text className="text-foreground">{couponAmount(coupon, currency, formatMoney)}</Text>
          </Pressable>
        )) : <Text className="text-muted-foreground">No coupons found</Text>}
      </ScrollView>
      <DialogFooter>
        <Button variant="outline" onPress={onClose}><Text>Cancel</Text></Button>
        <Button disabled={!selected || applying} onPress={() => { void apply(); }}><Text>Apply</Text></Button>
      </DialogFooter>
    </View>
  );
}
