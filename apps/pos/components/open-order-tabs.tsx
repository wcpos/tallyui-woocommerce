import { useEffect, useRef, useState, type JSX } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Path } from 'react-native-svg';
import { createSvgIcon, Text } from '@tallyui/components';
import { formatMoney } from '@tallyui/core';
import { tabWho } from '../lib/sale/tab-who';

// lucide `chevron-up` / `chevron-down`: v2's count cell points the way the list will travel (cart/tabs.tsx).
const ChevronUpIcon = createSvgIcon('ChevronUpIcon', () => <Path d="m18 15-6-6-6 6" />);
const ChevronDownIcon = createSvgIcon('ChevronDownIcon', () => <Path d="m6 9 6 6 6-6" />);

// The ages tick once a minute (v2 cart/open-orders-list.tsx AGE_TICK_MS).
export const AGE_TICK_MS = 60_000;
// A cart parked for an hour is one somebody forgot: its tab shows its age in the warning tone
// (v2 cart/open-orders-list.tsx STALE_AFTER_MS).
export const STALE_AFTER_MS = 60 * 60_000;
const HOUR_MS = 3_600_000;
// The widest + cell, reserved so the blank cart's wider + cannot toggle the count cell (v2 cart/tab-window.ts NEW_TAB_WIDTH).
const NEW_TAB_WIDTH = 112;

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
  /** Open the full list of open orders; the count cell that calls it shows only when the tabs overflow. */
  onOpenList?: () => void;
  /** The list is open: the count cell's chevron points down, back the way it closes. */
  listOpen?: boolean;
  /** The clock the tab ages read; tests pass their own. */
  now?: () => number;
  /** A phone: each tab is one line, the name then the amount (v2 TabContent's `phone`); otherwise the amount sits under the name. */
  compact?: boolean;
}

/** The open-order strip under the cart: parked carts, the current sale, then + (WCPOS v2 cart/tabs.tsx). */
export function OpenOrderTabs({ parked, current, currency, locale, onSelect, onNew, onError, onOpenList, listOpen = false, now = Date.now, compact = false }: OpenOrderTabsProps): JSX.Element {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(now);
  const [stripWidth, setStripWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const clock = useRef(now);
  clock.current = now;
  useEffect(() => {
    const timer = setInterval(() => setNowMs(clock.current()), AGE_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  // v2's rowOverflows: the tabs overflow once they need more than the strip less the widest + cell.
  const overflow = stripWidth > 0 && contentWidth > stripWidth - NEW_TAB_WIDTH;
  // The blank cart has no tab of its own: + is its tab, and pressing + there is a place, not an action (v2).
  const fresh = current.lineItems.length === 0;
  // v2 seeds every walk-in cart with the guest's own name, "Guest" (hooks/use-guest-customer.ts, read by
  // contexts/current-order/use-new-order.ts), so its tabWho returns that name and every tab, phone or wide,
  // reads "Guest $16.83", never the contents. Tally's walk-in cart has no customer, so the tab reads no contents.
  const who = (customerName: string | undefined) => tabWho({ customerName, lines: [] });

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

  function tab(id: string, selected: boolean, who: string, totalMinor: number, onPress?: () => void, parkedAt?: string) {
    // Only a parked cart has a start time; Tally's open sale has none, so its tab never shows an age.
    const delta = parkedAt === undefined ? NaN : nowMs - Date.parse(parkedAt);
    const stale = delta >= STALE_AFTER_MS;
    return (
      <Pressable key={id} testID={`open-order-tab-${id}`} role="tab" aria-selected={selected} disabled={busy} onPress={onPress}
        className={`h-full min-w-0 justify-center border-b-2 px-3 web:hover:bg-accent active:bg-accent ${selected ? 'border-primary' : 'border-transparent'}`}>
        <View testID={`open-order-tab-${id}-content`} className={compact ? 'items-center gap-1' : undefined}
          style={{ flexDirection: compact ? 'row' : 'column' }}>
          <Text testID={`open-order-tab-${id}-who`} numberOfLines={1}
            className={`max-w-52 ${selected ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>{who}</Text>
          <Text testID={`open-order-tab-${id}-amount`} numberOfLines={1} className="text-muted-foreground tabular-nums">
            {formatMoney({ amount: totalMinor, currency }, locale) ?? String(totalMinor)}
            {/* Only the age carries the warning tone; the separator stays muted (v2 TabContent). */}
            {stale ? <>{' · '}<Text testID={`open-order-tab-${id}-age`} className="font-semibold text-warning">
              {`${Math.round(delta / HOUR_MS)} h`}
            </Text></> : null}
          </Text>
        </View>
      </Pressable>
    );
  }

  // Oldest first, newer carts join on the right. The store hands them over newest first, so sort a copy.
  const sorted = [...parked].sort((a, b) => a.parkedAt.localeCompare(b.parkedAt));
  const openCount = parked.length + (fresh ? 0 : 1);

  return (
    <View testID="open-order-strip" role="tablist" className="h-13 flex-row items-stretch border-t border-border bg-card"
      onLayout={({ nativeEvent: { layout } }) => setStripWidth(layout.width)}>
      {overflow ? (
        <Pressable testID="open-orders-count" role="button" accessibilityLabel={`${openCount} open`} aria-expanded={listOpen} onPress={() => onOpenList?.()}
          className="h-full min-w-14 flex-row items-center justify-center gap-1 border-r border-border px-2.5 web:hover:bg-accent active:bg-accent">
          <Text className="rounded-full bg-muted px-2 text-sm font-medium text-muted-foreground tabular-nums">{String(openCount)}</Text>
          {/* The list rises over the cart from the strip at its foot, and falls back to it. */}
          {listOpen
            ? <ChevronDownIcon testID="open-orders-chevron-down" size={16} className="text-muted-foreground" />
            : <ChevronUpIcon testID="open-orders-chevron-up" size={16} className="text-muted-foreground" />}
        </Pressable>
      ) : null}
      <ScrollView testID="open-order-scroll" horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" className="min-w-0 flex-1"
        onContentSizeChange={width => setContentWidth(width)}>
        {sorted.map(cart => tab(cart.id, false,
          who(cart.customer?.name),
          cart.totalMinor, () => void run(() => onSelect(cart.id)), cart.parkedAt))}
        {fresh ? null : tab(current.id, true,
          who(current.customer?.name),
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
