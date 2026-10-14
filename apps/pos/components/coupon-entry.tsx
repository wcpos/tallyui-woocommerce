import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { RxCollection } from 'rxdb';
import { formatMoney, moneyFromDecimalString } from '@tallyui/core';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Text } from '@tallyui/components';
import type { useSale } from '@tallyui/pos';

const typeLabels: Record<string, string> = {
  percent: 'Percentage discount', fixed_cart: 'Fixed cart discount', fixed_product: 'Fixed product discount',
};

interface CouponDoc { code: string; status?: string; amount?: string; discount_type?: string; description?: string }

function couponAmount(coupon: CouponDoc, currency: string): string {
  const amount = coupon.amount ?? '';
  if (coupon.discount_type === 'percent') return `${Number(amount)}%`;
  const money = moneyFromDecimalString(amount, currency);
  return (money && formatMoney(money)) ?? amount;
}

// WCPOS v2's applied coupons: one row per coupon under the cart's Subtotal, a removable chip and its amount.
export function CouponRows({ sale }: { sale: ReturnType<typeof useSale> }): JSX.Element | null {
  const [removeError, setRemoveError] = useState<string | null>(null);
  const applied = sale.order.display.coupons ?? [];
  if (!applied.length) return null;
  const minus = (amountMinor: number) => `-${formatMoney({ amount: amountMinor, currency: sale.order.currency }) ?? amountMinor}`;
  return (
    <>
      {applied.map(coupon => (
        <View key={coupon.code} testID={`coupon-chip-${coupon.code}`} className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2 rounded-md border border-border bg-card px-2 py-1">
            <Text className="text-foreground">{coupon.code}</Text>
            <Button variant="ghost" size="sm" accessibilityLabel={`Remove coupon ${coupon.code}`}
              onPress={() => setRemoveError(sale.removeCoupon(coupon.code))}><Text>×</Text></Button>
          </View>
          <Text className="text-muted-foreground">{minus(coupon.amountMinor)}</Text>
        </View>
      ))}
      {removeError ? <Text accessibilityRole="alert" className="text-destructive">{removeError}</Text> : null}
    </>
  );
}

// WCPOS v2's coupon picker over the synced coupons (no free-text code entry).
export function CouponEntry({ sale, coupons, currency }: {
  sale: ReturnType<typeof useSale>; coupons: RxCollection; currency: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
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

  function close() {
    setOpen(false);
    setSearch('');
    setSelected(null);
    setError(null);
  }

  async function apply() {
    if (!selected) return;
    setApplying(true);
    const refusal = await sale.applyCoupon(selected);
    setApplying(false);
    if (refusal === null) close();
    else setError(refusal);
  }

  return (
    <View className="gap-2 py-2">
      <Button variant="outline" disabled={!sale.order.lineItems.length}
        onPress={() => setOpen(true)}><Text>Add coupon</Text></Button>
      {open && <Dialog open onOpenChange={next => { if (!next) close(); }}>
        <DialogContent className="w-full max-w-lg">
          <DialogHeader><DialogTitle>Add coupon</DialogTitle></DialogHeader>
          <Input><Input.Field value={search} onChangeText={setSearch} placeholder="Search coupons..."
            accessibilityLabel="Search coupons" autoCapitalize="none" /></Input>
          <Text className="text-muted-foreground">{selected ?? 'Select coupon...'}</Text>
          <ScrollView style={{ maxHeight: 320 }}>
            {listed.length ? listed.map(coupon => (
              <Pressable key={coupon.code} accessibilityRole="button" accessibilityLabel={coupon.code}
                // react-native-web reads aria-selected, not accessibilityState.
                accessibilityState={{ selected: selected === coupon.code }} aria-selected={selected === coupon.code} onPress={() => setSelected(coupon.code)}
                className={`flex-row items-center justify-between gap-2 rounded-md border border-border px-3 py-2 ${selected === coupon.code ? 'bg-accent' : 'bg-card'}`}>
                <View className="flex-1">
                  <Text className="text-foreground">{coupon.code}</Text>
                  <Text className="text-muted-foreground">{coupon.description || typeLabels[coupon.discount_type ?? ''] || ''}</Text>
                </View>
                <Text className="text-foreground">{couponAmount(coupon, currency)}</Text>
              </Pressable>
            )) : <Text className="text-muted-foreground">No coupons found</Text>}
          </ScrollView>
          {error ? <Text accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
          <DialogFooter>
            <Button variant="outline" onPress={close}><Text>Cancel</Text></Button>
            <Button disabled={!selected || applying} onPress={() => { void apply(); }}><Text>Apply</Text></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}
    </View>
  );
}
