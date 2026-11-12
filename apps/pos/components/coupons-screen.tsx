// v2's Coupons area (WCPOS monorepo `packages/core/src/screens/main/coupons/index.tsx`), read-only: the default
// columns of ui-settings `initial-settings.json` "coupons" without Actions, newest first (date_created_gmt desc),
// and the cell rules of cells/active.tsx, usage.tsx, editable-amount.tsx, editable-date.tsx and discount-type.tsx.
// The Status, Discount Type and Expires filter chips and Clear all follow v2's coupons/filter-bar/, combined with the
// search (AND). The bar's display options switch v2's columns (area-display-options.tsx). Deviations: no inline
// editing, Add, Actions column, column reordering or sortable headers, since edits must go through the store's REST
// API; the coupons collection is replicated from the server, so this screen never writes to it. The expiry date shows in the device's time zone, not the store's (v2's date-picker-input.tsx), and the
// Expires chip offers the report date presets instead of v2's calendar.
import { useEffect, useState } from 'react';
import type { ComponentType, JSX } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Circle, Path, Rect } from 'react-native-svg';
import type { RxCollection } from 'rxdb';
import { formatMoney, moneyFromDecimalString } from '@tallyui/core';
import { DATE_PRESETS, inRange, presetRange } from '@tallyui/pos';
import type { DatePreset } from '@tallyui/pos';
import {
  Button, createSvgIcon, SearchInput, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, Table, TableBody,
  TableCell, TableHead, TableHeader, TableRow, Text, XIcon,
} from '@tallyui/components';
import type { SvgIconProps } from '@tallyui/components';
import { useAreaColumns } from '../lib/area-columns';
import type { AreaColumn } from '../lib/area-columns';
import { AreaDisplayOptions } from './area-display-options';
import { AreaToolbar, useAreaGutter } from './area-header';
import {
  CHIP_CLEAR_CELL_CLASS, CHIP_CLEAR_GLYPH_SIZE, chipInkClassName, filterChipClassName, filterChipTextClassName,
} from './catalogue-filter-chips';
import { StatusDot } from './status-dot';
import type { StatusTone } from './status-dot';
import { CaptionRowInset, TableCount, TableSurface, useCatalogueSync } from './table-surface';

// v2's QuerySearchInput debounce (packages/core/src/screens/main/components/query-search-input.tsx:33).
const SEARCH_DEBOUNCE_MS = 250;
// The width below which the table becomes a list, as customers-screen.tsx.
const NARROW_WIDTH = 600;

// v2 coupons/discount-type-label.ts with the English strings of core.json; an unknown type reads as itself.
const TYPE_LABELS: Record<string, string> = { percent: 'Percentage', fixed_cart: 'Fixed Cart', fixed_product: 'Fixed Product' };

// v2's filter-bar choices (status-pill.tsx, discount-type-pill.tsx) with the English strings of core.json.
type Choice = { value: string; label: string; testID: string };
const STATUS_CHOICES: Choice[] = [
  { value: 'publish', label: 'Published', testID: 'coupon-filter-status-publish' },
  { value: 'draft', label: 'Draft', testID: 'coupon-filter-status-draft' },
  { value: 'pending', label: 'Pending', testID: 'coupon-filter-status-pending' },
  { value: 'trash', label: 'Trash', testID: 'coupon-filter-status-trash' },
];
const TYPE_CHOICES: Choice[] = [
  { value: 'percent', label: 'Percentage Discount', testID: 'coupon-filter-type-percent' },
  { value: 'fixed_cart', label: 'Fixed Cart Discount', testID: 'coupon-filter-type-fixed_cart' },
  { value: 'fixed_product', label: 'Fixed Product Discount', testID: 'coupon-filter-type-fixed_product' },
];
const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Today', yesterday: 'Yesterday', thisWeek: 'This week', lastWeek: 'Last week', thisMonth: 'This month', lastMonth: 'Last month',
};
// Deviation from v2's date-range-pill.tsx, which opens a range calendar: Tally has no calendar component, so the chip
// offers the report date presets, as device-local days.
const EXPIRES_CHOICES: Choice[] = DATE_PRESETS.map(value => ({ value, label: PRESET_LABELS[value], testID: `coupon-filter-expires-${value}` }));

// The chips' icons, after v2's `info`, `percent` and `calendar` (lucide).
const InfoIcon = createSvgIcon('InfoIcon', () => <><Circle cx={12} cy={12} r={10} /><Path d="M12 16v-4" /><Path d="M12 8h.01" /></>);
const PercentIcon = createSvgIcon('PercentIcon', () => <>
  <Path d="M19 5 5 19" /><Circle cx={6.5} cy={6.5} r={2.5} /><Circle cx={17.5} cy={17.5} r={2.5} />
</>);
const CalendarIcon = createSvgIcon('CalendarIcon', () => <>
  <Rect x={3} y={4} width={18} height={18} rx={2} /><Path d="M16 2v4" /><Path d="M8 2v4" /><Path d="M3 10h18" />
</>);

type FilterKey = 'status' | 'discount_type' | 'date_expires_gmt';
type CouponFilters = Partial<Record<FilterKey, string>>;

export type CouponsColumnId = 'active' | 'code' | 'amount' | 'discount_type' | 'description' | 'usage_count'
  | 'date_expires_gmt' | 'status' | 'date_created_gmt' | 'date_modified_gmt';
// v2's coupons columns (ui-settings/initial-settings.json `coupons.columns`), in its order, with v2's keys, its `show`
// and its labels (use-ui-label.ts), without Actions; className sizes each cell in the row's flex layout. Every one
// of them is a field of the replicated coupon doc.
export const COUPONS_COLUMNS: readonly (AreaColumn<CouponsColumnId> & { className?: string })[] = [
  { id: 'active', label: 'Active', visible: true, className: 'w-28 flex-none' },
  { id: 'code', label: 'Code', visible: true },
  { id: 'amount', label: 'Amount', visible: true },
  { id: 'discount_type', label: 'Type', visible: true },
  { id: 'description', label: 'Description', visible: true, className: 'flex-[2]' },
  { id: 'usage_count', label: 'Usage', visible: true },
  { id: 'date_expires_gmt', label: 'Expiry Date', visible: true },
  { id: 'status', label: 'Status', visible: false },
  { id: 'date_created_gmt', label: 'Date Created', visible: false },
  { id: 'date_modified_gmt', label: 'Date Modified', visible: false },
];

// v2 coupons/cells/status.tsx: its tones (publish ok, draft muted, pending warning) and core.json's words. An unknown
// status reads as itself with a muted dot, where v2 uses its `default` tone.
const STATUS_TONE: Record<string, StatusTone> = { publish: 'success', draft: 'muted', pending: 'warning' };

// v2's body cell (components/src/table/index.tsx:129, `flex-col justify-center px-3 py-1.5`), as orders-table.tsx's
// CELL: every cell centres its content on the row with v2's padding. The head takes the same px-3
// (table/index.tsx:112) so each label stays over its column. Its height is v2's ResizeHead `min-h-row`, 44 px
// (core data-table/resize.tsx:40 over table/index.tsx:112 `h-9 justify-center`; global.css:41 `--spacing-row`).
const CELL = 'justify-center px-3 py-1.5';
const HEAD = 'min-h-11 justify-center px-3';
// v2's coupons aligns (ui-settings/initial-settings.json:511 Amount `right`, :528 Usage `center`), on the head and
// the cell alike (data-table/column-style.ts:15-22 alignItems, header.tsx:36-47).
const ALIGN: Partial<Record<CouponsColumnId, string>> = { amount: 'items-end', usage_count: 'items-center' };
const classes = (...names: (string | undefined)[]) => names.filter(Boolean).join(' ');

interface CouponDoc {
  uuid: string;
  code: string;
  status?: string;
  amount?: string;
  discount_type?: string;
  description?: string;
  date_created_gmt?: string;
  date_modified_gmt?: string;
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

/** v2 date-picker-input.tsx shows `d MMM yyyy`; here the same parts in the locale, with no time. The other date
 *  columns (created, modified) and the products area's date read the same way. */
export function gmtDayText(value: string | null | undefined, locale: string | undefined): string {
  if (!value) return '';
  const date = utcDate(value);
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

/** The chips, each an equality on its field (AND); Expires keeps a coupon whose expiry, a UTC instant, falls on a
 *  device-local day of the preset's range. A coupon with no expiry never matches Expires. */
function passes(coupon: CouponDoc, filters: CouponFilters, now: Date): boolean {
  if (filters.status && coupon.status !== filters.status) return false;
  if (filters.discount_type && coupon.discount_type !== filters.discount_type) return false;
  const preset = filters.date_expires_gmt as DatePreset | undefined;
  if (!preset) return true;
  const expires = coupon.date_expires_gmt;
  if (!expires || Number.isNaN(utcDate(expires).getTime())) return false;
  return inRange(expires, presetRange(preset, now, 'device'), 'device');
}

/** One v2 filter pill in the catalogue chips' pattern: a select of choices, tinted when on, with a clear. */
function FilterPill({ field, icon: Icon, label, value, choices, onChoose, onRemove }: {
  field: FilterKey; icon: ComponentType<SvgIconProps>; label: string; value: string | undefined; choices: readonly Choice[];
  onChoose(value: string): void; onRemove(): void;
}): JSX.Element {
  const selected = choices.find(choice => choice.value === value);
  const active = selected !== undefined;
  return <View className={filterChipClassName(active)}>
    <Select value={selected && { value: selected.value, label: selected.label }}
      onValueChange={option => { if (option) onChoose(option.value); }}>
      {/* v2's filter chips draw no chevron (filter-bar). */}
      <SelectTrigger testID={`filter-pill-${field}`} chevron={false} className="h-auto w-auto justify-start gap-1.5 rounded-none border-0 bg-transparent px-0 py-0">
        {/* An on chip's icon and × take its ink (v2 chip/index.tsx:106), as the catalogue chips' do. */}
        <Icon size={16} className={active ? chipInkClassName(true) : undefined} />
        <Text className={filterChipTextClassName(active)}>{selected?.label ?? label}</Text>
      </SelectTrigger>
      <SelectContent><SelectGroup>
        {choices.map(choice => <SelectItem key={choice.value} value={choice.value} label={choice.label} testID={choice.testID}>
          <Text>{choice.label}</Text>
        </SelectItem>)}
      </SelectGroup></SelectContent>
    </Select>
    {/* v2's clear cell and mark (chip/index.tsx:211-222, :239), shared with the catalogue chips. */}
    {active && <Pressable testID={`filter-pill-remove-${field}`} role="button" accessibilityLabel="Remove"
      className={CHIP_CLEAR_CELL_CLASS} onPress={onRemove}>
      <XIcon size={CHIP_CLEAR_GLYPH_SIZE} className={chipInkClassName(true)} />
    </Pressable>}
  </View>;
}

function ActiveBadge({ coupon, now }: { coupon: CouponDoc; now: Date }): JSX.Element {
  const active = isActive(coupon, now);
  // v2's ActiveBadge (cells/active.tsx): StatusBadge `ok` for Active, `muted` for Inactive.
  return <StatusDot testID={`coupon-active-${coupon.code}`} tone={active ? 'success' : 'muted'} label={active ? 'Active' : 'Inactive'} />;
}

/** One body cell's content; the table draws its TableCell. */
function couponContent(id: CouponsColumnId, c: CouponDoc, now: Date, currency: string, locale: string | undefined): JSX.Element {
  switch (id) {
    case 'active': return <ActiveBadge coupon={c} now={now} />;
    case 'code': return <Text className="font-medium">{c.code}</Text>;
    case 'amount': return <Text>{couponAmount(c, currency, locale)}</Text>;
    case 'discount_type': return <Text>{typeLabel(c)}</Text>;
    case 'description': return <Text>{c.description ?? ''}</Text>;
    case 'usage_count': return <Text testID={`coupon-usage-${c.code}`}>{usageText(c)}</Text>;
    case 'date_expires_gmt': return <Text testID={`coupon-expiry-${c.code}`}>{gmtDayText(c.date_expires_gmt, locale)}</Text>;
    case 'status': {
      const status = c.status ?? '';
      const label = STATUS_CHOICES.find(choice => choice.value === status)?.label ?? status;
      return <StatusDot testID={`coupon-status-${c.code}`} tone={STATUS_TONE[status] ?? 'muted'} label={label} />;
    }
    case 'date_created_gmt':
    case 'date_modified_gmt':
      return <Text testID={`coupon-${id}-${c.code}`}>{gmtDayText(c[id], locale)}</Text>;
  }
}

export function CouponsScreen({ coupons, currency, locale: storeLocale, onBack }: CouponsScreenProps): JSX.Element {
  const [all, setAll] = useState<CouponDoc[] | null>(null);
  // v2's page gutter (ground.ts:46-72): the chip row sits on the bar's 12 in a window, 16 on a phone.
  const gutter = useAreaGutter();
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<CouponFilters>({});
  const [settings, setSettings] = useAreaColumns('coupons', COUPONS_COLUMNS);
  const { width } = useWindowDimensions();
  const sync = useCatalogueSync();
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

  function clear() { setTerm(''); setQuery(''); setFilters({}); }
  function setFilter(field: FilterKey, value: string | undefined) {
    setFilters(current => {
      const next = { ...current };
      if (value === undefined) delete next[field];
      else next[field] = value;
      return next;
    });
  }
  function pill(field: FilterKey, icon: ComponentType<SvgIconProps>, label: string, choices: readonly Choice[]): JSX.Element {
    return <FilterPill field={field} icon={icon} label={label} value={filters[field]} choices={choices}
      onChoose={value => setFilter(field, value)} onRemove={() => setFilter(field, undefined)} />;
  }

  const now = new Date();
  const shown = all ? all.filter(coupon => (!query || matches(coupon, query)) && passes(coupon, filters, now)) : [];
  const total = all?.length ?? 0;
  // The columns the display options leave on, in the area's order.
  const columns = COUPONS_COLUMNS.filter(column => settings.some(setting => setting.id === column.id && setting.visible));

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
            {columns.map(({ id, label, className }) => (
              <TableHead key={id} testID={`coupons-head-${id}`} className={classes(HEAD, ALIGN[id], className)}>
                <Text testID={`coupons-header-${id}`}>{label}</Text>
              </TableHead>
            ))}
          </TableRow></TableHeader>
          <TableBody>
            {shown.map(c => <TableRow key={c.uuid} testID={`coupons-row-${c.code}`}>
              {columns.map(({ id, className }) => <TableCell key={id} testID={`coupons-cell-${id}-${c.code}`}
                className={classes(CELL, ALIGN[id], className)}>{couponContent(id, c, now, currency, locale)}</TableCell>)}
            </TableRow>)}
          </TableBody>
        </Table>}
      </ScrollView>
  );

  return (
    <View testID="screen-coupons" className="flex-1 bg-background">
      <AreaToolbar area="coupons" title="Coupons" onBack={onBack}
        search={<SearchInput testID="search-coupons" value={term} onChangeText={setTerm} placeholder="Search Coupons" />}>
        <AreaDisplayOptions area="coupons" columns={COUPONS_COLUMNS} settings={settings} onChange={setSettings} />
      </AreaToolbar>
      <View testID="coupons-filter-row" className={`pb-2 ${gutter}`}>
        <View testID="coupons-filter-chips" className="flex-row flex-wrap items-center gap-2">
          {pill('status', InfoIcon, 'Status', STATUS_CHOICES)}
          {pill('discount_type', PercentIcon, 'Discount Type', TYPE_CHOICES)}
          {pill('date_expires_gmt', CalendarIcon, 'Expires', EXPIRES_CHOICES)}
          {Object.keys(filters).length >= 2 && (
            <Button testID="coupons-filter-clear-all" variant="ghost" size="sm" onPress={() => setFilters({})}><Text>Clear all</Text></Button>
          )}
        </View>
      </View>
      <TableSurface testID="coupons-table-surface">{body}</TableSurface>
      {shown.length > 0 && (
        <CaptionRowInset><TableCount shown={shown.length} total={total} active={sync.active} onSync={sync.sync} /></CaptionRowInset>
      )}
    </View>
  );
}
