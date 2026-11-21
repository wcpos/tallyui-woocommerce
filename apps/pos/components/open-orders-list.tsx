import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { IconButton, Text, XIcon } from '@tallyui/components';
import { useFormatMoney } from '@tallyui/core';
import { getInitials } from '../lib/cashier/initials';
import { cartContentsLine, relativeAge } from '../lib/sale/cart-contents';
import { UserIcon } from './icons';
import { AGE_TICK_MS, STALE_AFTER_MS, stripCartIds } from './open-order-tabs';

type Lines = readonly { name: string; quantity?: number | null }[]; type Named = readonly { name: string }[];
export interface OpenOrdersListProps {
  parked: readonly { id: string; parkedAt: string; totalMinor: number; lines: Lines; customer?: { name: string } | null; fees?: Named; shipping?: Named }[];
  current: { id: string; totalMinor: number; lineItems: Lines; customer: { name: string } | null; fees?: Named; shipping?: Named };
  /** When the current cart was first parked: its place in the list and the start of its age. */
  currentOpenedAt?: string;
  currency: string; locale?: string;
  /** Resume a parked cart (sale-screen's resume): resolves null when done, or a message. */
  onSelect: (id: string) => Promise<string | null>;
  onClose: () => void; onError: (message: string) => void;
  /** The list is sliding out: focus has gone back to the strip and must stay there. */
  leaving?: boolean;
  now?: () => number;
}

// The full list of open orders behind the strip's count cell (v2 cart/open-orders-list.tsx). Not copied, by design: v2's status
// chips (TabChip: saving, queued, refused, partly paid), since local parked carts have none (AUDIT 647, connector); the virtualized
// list, since the carts are local and few (a FlatList); and the "restarts on add" age rule (cartRestartsOnAdd), for server pos-open
// orders the app does not have (the blank cart has no row). Copied: the current row's focus on open and the `leaving` prop.
export function OpenOrdersList({ parked, current, currentOpenedAt, currency, locale, onSelect, onClose, onError, leaving = false, now = Date.now }: OpenOrdersListProps): JSX.Element {
  const formatMoney = useFormatMoney();
  // The ages tick as the strip's do (open-order-tabs.tsx:85-101).
  const [nowMs, setNowMs] = useState(now);
  const clock = useRef(now); clock.current = now;
  useEffect(() => {
    const timer = setInterval(() => setNowMs(clock.current()), AGE_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  // The strip's carts in its order; the current cart's age starts at currentOpenedAt, a parked one's at parkedAt.
  const rows = stripCartIds(parked, current, currentOpenedAt).map(id => {
    const cart = parked.find(each => each.id === id);
    return cart ? { ...cart, startedAt: cart.parkedAt as string | undefined, open: false } : { ...current, lines: current.lineItems, startedAt: currentOpenedAt, open: true };
  });
  // The row is focused while its list is still sliding in: without `preventScroll` the browser scrolls the clipping
  // frame to bring it into view and the slide jumps (v2 cart/open-orders-list.tsx:112-121).
  const focusCurrent = useCallback((node: unknown) => {
    if (!leaving) (node as { focus?: (options?: FocusOptions) => void } | null)?.focus?.({ preventScroll: true });
  }, [leaving]);
  // The open cart is already open, so its row only closes the list (v2). A message or a rejection goes to onError, never a throw.
  async function press(id: string, open: boolean) {
    try {
      const message = open ? null : await onSelect(id);
      if (typeof message === 'string') onError(message);
    } catch (error) { onError(error instanceof Error ? error.message : String(error)); }
    onClose();
  }

  return (
    <View testID="open-orders-list" className="flex-1">
      {/* v2's header; its `h-ctl` is 44 px, the app's h-11 (sheet.tsx). */}
      <View className="h-11 flex-row items-center justify-between border-b border-border px-2">
        <Text>Open orders</Text>
        <IconButton variant="ghost" className="h-11 w-11" testID="open-orders-close" accessibilityLabel="Close" onPress={onClose}><XIcon size={18} /></IconButton>
      </View>
      <FlatList data={rows} keyExtractor={row => row.id} renderItem={({ item: row }) => {
        const name = row.customer?.name.trim();
        const span = row.startedAt === undefined ? NaN : nowMs - Date.parse(row.startedAt);
        return (
          // v2 ListRow size="sm" with `selected`: the open cart is the filled row with a bar on its left.
          <Pressable testID={`open-orders-row-${row.id}`} role="button" ref={row.open ? focusCurrent : undefined} onPress={() => void press(row.id, row.open)}
            className={`min-h-11 flex-row items-center gap-3 border-b border-l-2 border-border px-3 py-2 pl-2.5 active:bg-muted web:hover:bg-muted ${row.open ? 'border-l-primary bg-muted' : 'border-l-transparent'}`}>
            {/* v2 Avatar md (size-9, text-xs initials), in the tone of customer-picker.tsx Initials and GuestMark. */}
            <View aria-hidden className="size-9 items-center justify-center rounded-full bg-muted">
              {name ? <Text className="text-xs font-medium">{getInitials(name)}</Text> : <UserIcon testID="customer-guest-icon" size={18} className="text-muted-foreground" />}
            </View>
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="font-semibold">{name || 'Guest'}</Text>
              <Text testID={`open-orders-row-${row.id}-items`} numberOfLines={1} className="text-sm text-muted-foreground">{cartContentsLine(row) || 'Empty'}</Text>
            </View>
            <View className="items-end gap-0.5">
              <Text className="tabular-nums">{formatMoney({ amount: row.totalMinor, currency }, locale) ?? String(row.totalMinor)}</Text>
              {/* From STALE_AFTER_MS the age turns the warning tone (v2 cart/open-orders-list.tsx). */}
              {Number.isNaN(span) ? null : <Text testID={`open-orders-row-${row.id}-age`}
                className={span >= STALE_AFTER_MS ? 'text-sm font-semibold text-warning-text' : 'text-sm text-muted-foreground'}>{relativeAge(0, span)}</Text>}
            </View>
          </Pressable>
        );
      }} />
    </View>
  );
}
