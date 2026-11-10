import { useRef, useState, type JSX } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@tallyui/components';
import { formatMoney } from '@tallyui/core';
import { tabWho } from '../lib/sale/tab-who';

export interface OpenOrderTabsParked {
  id: string; parkedAt: string; totalMinor: number;
  lines: readonly { name: string }[];
  customer?: { name: string } | null;
  fees?: readonly { name: string }[];
  shipping?: readonly { name: string }[];
}

export interface OpenOrderTabsCurrent {
  id: string; totalMinor: number;
  lineItems: readonly { name: string }[];
  customer: { name: string } | null;
  fees?: readonly { name: string }[];
  shipping?: readonly { name: string }[];
}

export interface OpenOrderTabsProps {
  parked: readonly OpenOrderTabsParked[];
  current: OpenOrderTabsCurrent;
  currency: string;
  locale?: string;
  /** Resume a parked cart (sale-screen's onResume): resolves null when done, or a message. */
  onSelect: (parkedId: string) => Promise<string | null>;
  /** Park the current sale and start a blank one (sale-screen's onPark). */
  onNew: () => Promise<string | null>;
  onError: (message: string) => void;
}

/** The open-order strip under the cart: parked carts, the current sale, then + (WCPOS v2 cart/tabs.tsx). */
export function OpenOrderTabs({ parked, current, currency, locale, onSelect, onNew, onError }: OpenOrderTabsProps): JSX.Element {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  // The blank cart has no tab of its own: + is its tab, and pressing + there is a place, not an action (v2).
  const fresh = current.lineItems.length === 0;

  async function run(action: () => Promise<string | null>) {
    // The ref stops a second tap in the same frame; busy disables the cells until the action settles.
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const result = await action();
      if (typeof result === 'string') onError(result);
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function tab(id: string, selected: boolean, who: string, totalMinor: number, onPress?: () => void) {
    return (
      <Pressable key={id} testID={`open-order-tab-${id}`} role="tab" aria-selected={selected} disabled={busy} onPress={onPress}
        className={`h-full min-w-0 justify-center border-b-2 px-3 web:hover:bg-accent active:bg-accent ${selected ? 'border-primary' : 'border-transparent'}`}>
        <View>
          <Text testID={`open-order-tab-${id}-who`} numberOfLines={1}
            className={`max-w-52 ${selected ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>{who}</Text>
          <Text testID={`open-order-tab-${id}-amount`} numberOfLines={1} className="text-muted-foreground tabular-nums">
            {formatMoney({ amount: totalMinor, currency }, locale) ?? String(totalMinor)}
          </Text>
        </View>
      </Pressable>
    );
  }

  // Oldest first, newer carts join on the right. The store hands them over newest first, so sort a copy.
  const sorted = [...parked].sort((a, b) => a.parkedAt.localeCompare(b.parkedAt));

  return (
    <View testID="open-order-strip" role="tablist" className="h-13 flex-row items-stretch border-t border-border bg-card">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" className="min-w-0 flex-1">
        {sorted.map(cart => tab(cart.id, false,
          tabWho({ customerName: cart.customer?.name, lines: cart.lines, fees: cart.fees, shipping: cart.shipping }),
          cart.totalMinor, () => void run(() => onSelect(cart.id))))}
        {fresh ? null : tab(current.id, true,
          tabWho({ customerName: current.customer?.name, lines: current.lineItems, fees: current.fees, shipping: current.shipping }),
          current.totalMinor)}
      </ScrollView>
      <Pressable testID="new-order-tab" role="tab" aria-selected={fresh} accessibilityLabel="New order" disabled={busy}
        onPress={() => { if (!fresh) void run(onNew); }}
        className={`h-full flex-row items-center justify-center gap-1.5 px-3 web:hover:bg-accent active:bg-accent ${fresh ? 'border-b-2 border-primary' : ''}`}>
        <Text className={`text-lg ${fresh ? 'text-primary' : ''}`}>+</Text>
        {fresh ? <Text testID="new-order-tab-label" className="font-semibold">New</Text> : null}
      </Pressable>
    </View>
  );
}
