// v2's Coupons area (WCPOS monorepo `packages/core/src/screens/main/coupons/index.tsx`), read-only: the default
// columns of ui-settings `initial-settings.json` "coupons" without Actions, newest first (date_created_gmt desc),
// and the cell rules of cells/active.tsx, usage.tsx, editable-amount.tsx, editable-date.tsx and discount-type.tsx.
// Deviations: no inline editing, Add, filter chips, Actions column, column settings or sortable headers, since edits
// must go through the store's REST API; the coupons collection is replicated from the server, so this screen never
// writes to it. The expiry date shows in the device's time zone, not the store's (v2's date-picker-input.tsx).
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import type { RxCollection } from 'rxdb';
import { formatMoney, moneyFromDecimalString } from '@tallyui/core';
import { Badge, Button, SearchInput, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Text } from '@tallyui/components';

// v2's QuerySearchInput debounce (packages/core/src/screens/main/components/query-search-input.tsx:33).
const SEARCH_DEBOUNCE_MS = 250;
// The width below which the table becomes a list, as customers-screen.tsx.
const NARROW_WIDTH = 600;

// v2 coupons/discount-type-label.ts with the English strings of core.json; an unknown type reads as itself.
const TYPE_LABELS: Record<string, string> = { percent: 'Percentage', fixed_cart: 'Fixed Cart', fixed_product: 'Fixed Product' };

// The default shown columns, in v2's order, without Actions; className sizes each cell in the row's flex layout.
const COLUMNS = [
  { id: 'active', label: 'Active', className: 'w-28 flex-none' },
  { id: 'code', label: 'Code', className: undefined },
  { id: 'amount', label: 'Amount', className: undefined },
  { id: 'discount_type', label: 'Type', className: undefined },
  { id: 'description', label: 'Description', className: 'flex-[2]' },
  { id: 'usage_count', label: 'Usage', className: undefined },
  { id: 'date_expires_gmt', label: 'Expiry Date', className: undefined },
] as const;

interface CouponDoc {
  uuid: string;
  code: string;
  status?: string;
  amount?: string;
  discount_type?: string;
  description?: string;
  date_created_gmt?: string;
  date_expires_gmt?: string | null;
  usage_count?: number | null;
  usage_limit?: number | null;
}

export interface CouponsScreenProps {
  /** The local coupons collection; replicated from the store, so read only. */
  coupons: RxCollection;
  currency: string;
  /** The store's locale, WordPress style (`en_US`) or BCP 47. */
  locale?: string;
  onBack(): void;
}

/** v2's convertUTCStringToLocalDate (hooks/use-local-date.ts): WooCommerce's `_gmt` dates are UTC without the 'Z'. */
function utcDate(value: string): Date {
  return new Date(value.endsWith('Z') ? value : `${value}Z`);
}

/** v2 cells/active.tsx: published and not past its expiry. */
function isActive(coupon: CouponDoc, now: Date): boolean {
  const expired = coupon.date_expires_gmt ? utcDate(coupon.date_expires_gmt) < now : false;
  return coupon.status === 'publish' && !expired;
}

/** v2 cells/editable-amount.tsx: a percentage for `percent`, otherwise money in the store currency. */
function couponAmount(coupon: CouponDoc, currency: string, locale: string | undefined): string {
  const amount = coupon.amount ?? '';
  if (coupon.discount_type === 'percent') return `${Number(amount)}%`;
  const money = moneyFromDecimalString(amount, currency);
  return (money && formatMoney(money, locale)) ?? amount;
}

/** v2 cells/discount-type.tsx defaults a missing type to percent. */
function typeLabel(coupon: CouponDoc): string {
  const type = coupon.discount_type ?? 'percent';
  return TYPE_LABELS[type] ?? type;
}

/** v2 cells/usage.tsx: `count / limit` only for a positive limit; a cleared limit is 0 or null. */
function usageText(coupon: CouponDoc): string {
  const count = coupon.usage_count ?? 0;
  return coupon.usage_limit != null && coupon.usage_limit > 0 ? `${count} / ${coupon.usage_limit}` : String(count);
}

/** v2 date-picker-input.tsx shows `d MMM yyyy`; here the same parts in the locale, with no time. */
function expiryText(coupon: CouponDoc, locale: string | undefined): string {
  if (!coupon.date_expires_gmt) return '';
  const date = utcDate(coupon.date_expires_gmt);
  if (Number.isNaN(date.getTime())) return '';
  const options = { day: 'numeric', month: 'short', year: 'numeric' } as const;
  try {
    return date.toLocaleDateString(locale, options);
  } catch {
    return date.toLocaleDateString(undefined, options);
  }
}

/** date_created_gmt desc (v2's default sort); a coupon without one goes after, and code asc breaks ties. */
function newestFirst(a: CouponDoc, b: CouponDoc): number {
  const left = a.date_created_gmt ?? '';
  const right = b.date_created_gmt ?? '';
  if (left !== right) {
    if (!left) return 1;
    if (!right) return -1;
    return left < right ? 1 : -1;
  }
  return a.code.localeCompare(b.code);
}

function matches(coupon: CouponDoc, query: string): boolean {
  const needle = query.toLowerCase();
  return coupon.code.toLowerCase().includes(needle) || (coupon.description ?? '').toLowerCase().includes(needle);
}

function countLabel(shown: number, total: number): string {
  if (shown < total) return `Showing ${shown} of ${total}`;
  return total === 1 ? '1 coupon' : `${total} coupons`;
}

function ActiveBadge({ coupon, now }: { coupon: CouponDoc; now: Date }): JSX.Element {
  const active = isActive(coupon, now);
  return <Badge variant={active ? 'success' : 'secondary'} className="self-start rounded-md" label={active ? 'Active' : 'Inactive'} />;
}

export function CouponsScreen({ coupons, currency, locale: storeLocale, onBack }: CouponsScreenProps): JSX.Element {
  const [all, setAll] = useState<CouponDoc[] | null>(null);
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const { width } = useWindowDimensions();
  const locale = storeLocale?.replaceAll('_', '-');

  useEffect(() => {
    const subscription = coupons.find().$.subscribe(docs => {
      setAll(docs.map(doc => doc.toJSON() as CouponDoc).sort(newestFirst));
    });
    return () => subscription.unsubscribe();
  }, [coupons]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  function clear() { setTerm(''); setQuery(''); }

  const now = new Date();
  const shown = all ? (query ? all.filter(coupon => matches(coupon, query)) : all) : [];
  const total = all?.length ?? 0;

  const body = all === null ? null : total === 0 ? (
    <View testID="no-data-message" className="flex-1 items-center justify-center gap-2 p-6">
      <Text testID="no-data-message-title" className="text-center font-medium text-foreground">No coupons yet</Text>
      <Text testID="no-data-message-description" className="text-center text-muted-foreground">Coupons you create will appear here.</Text>
    </View>
  ) : shown.length === 0 ? (
    <View testID="no-data-message" className="flex-1 items-center justify-center gap-2 p-6">
      <Text testID="no-data-message-title" className="text-center font-medium text-foreground">No coupons match these filters</Text>
      <Button testID="no-data-message-action" variant="ghost" size="sm" onPress={clear}><Text>Clear filters</Text></Button>
    </View>
  ) : (
    <>
      <ScrollView testID="coupons-body">
        {width < NARROW_WIDTH ? shown.map(c => (
          <View key={c.uuid} testID={`coupons-row-${c.code}`} className="flex-row items-center gap-3 border-b border-border px-4 py-3">
            <View className="flex-1 gap-1">
              <Text className="font-medium text-foreground">{c.code}</Text>
              <Text numberOfLines={1} className="text-muted-foreground">{`${couponAmount(c, currency, locale)} · ${typeLabel(c)}`}</Text>
            </View>
            <ActiveBadge coupon={c} now={now} />
          </View>
        )) : <Table>
          <TableHeader><TableRow>
            {COLUMNS.map(({ id, label, className }) => (
              <TableHead key={id} className={className}><Text testID={`coupons-header-${id}`}>{label}</Text></TableHead>
            ))}
          </TableRow></TableHeader>
          <TableBody>
            {shown.map(c => <TableRow key={c.uuid} testID={`coupons-row-${c.code}`}>
              <TableCell className="w-28 flex-none"><ActiveBadge coupon={c} now={now} /></TableCell>
              <TableCell><Text className="font-medium">{c.code}</Text></TableCell>
              <TableCell><Text>{couponAmount(c, currency, locale)}</Text></TableCell>
              <TableCell><Text>{typeLabel(c)}</Text></TableCell>
              <TableCell className="flex-[2]"><Text>{c.description ?? ''}</Text></TableCell>
              <TableCell><Text testID={`coupon-usage-${c.code}`}>{usageText(c)}</Text></TableCell>
              <TableCell><Text testID={`coupon-expiry-${c.code}`}>{expiryText(c, locale)}</Text></TableCell>
            </TableRow>)}
          </TableBody>
        </Table>}
      </ScrollView>
      <View className="border-t border-border px-4 py-2">
        <Text testID="data-table-count" className="text-sm text-muted-foreground">{countLabel(shown.length, total)}</Text>
      </View>
    </>
  );

  return (
    <View testID="screen-coupons" className="flex-1 bg-background">
      <View className="flex-row items-center justify-between p-4">
        <Text accessibilityRole="header">Coupons</Text>
        <Button testID="coupons-back" onPress={onBack}><Text>Back</Text></Button>
      </View>
      <View className="px-4 pb-2">
        <SearchInput testID="search-coupons" value={term} onChangeText={setTerm} placeholder="Search Coupons" />
      </View>
      {body}
    </View>
  );
}
