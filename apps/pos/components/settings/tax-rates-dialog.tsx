import { useMemo, useState, type JSX } from 'react';
import { ScrollView, View } from 'react-native';
import { Path } from 'react-native-svg';
import {
  createSvgIcon, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, IconButton, Select, SelectContent, SelectGroup, SelectItem,
  SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList,
  TabsTrigger, Text, XIcon,
} from '@tallyui/components';
import { woocommerceTax, type StoreSettings, type StoreTaxRate } from '@tallyui/core';
import { useIsWide } from '../../lib/layout/wide';
import { taxClassOptions } from '../../lib/sale/tax-classes';
import { SHEET_TITLE, SheetCloseButton } from '../sheet';
import { ChevronDownIcon, SELECT_FACE } from '../select-chevron';
import { SETTINGS_HELP_CLASS, SETTINGS_KEY_CLASS } from './settings-form';

// WooCommerce sends rates as 4-decimal strings: "10.0000" reads 10%, "8.2500" 8.25%.
export function ratePercent(rate: string): string {
  const trimmed = rate.includes('.') ? rate.replace(/0+$/, '').replace(/\.$/, '') : rate;
  return `${trimmed}%`;
}

// @tallyui/core's woocommerceTax namespace exports these two as values only, so they are read off StoreSettings.
export type WooTaxRate = NonNullable<StoreSettings['taxRateTable']>[number];
export type TaxAddress = NonNullable<StoreSettings['baseTaxAddress']>;

// v2 tax-rates/rate-rows.ts:90-101: the ids of the rates the address matches, by the matcher the cart and the "Tax based on"
// panel use (TallyUI's port of v2's filterTaxRates over the store's whole table), so the marks agree with the panel.
export function matchedRateIds(table: WooTaxRate[], address: TaxAddress): ReadonlySet<string> {
  const { country, state, postcode, city } = address;
  return new Set(woocommerceTax.filterTaxRates(table, country, state, postcode, city).map(rate => String(rate.id)));
}

// v2 rate-rows.ts:103-106: whether the address the sheet was opened with matched this rate.
export function isApplied(appliesTo: ReadonlySet<string> | null, rate: Pick<StoreTaxRate, 'id'>): boolean {
  return appliesTo?.has(rate.id) ?? false;
}

// v2 rate-rows.ts:108-118 and en core.json tax_rates.count_applies*: the parenthesis only with a country.
export function appliesCount(n: number, country: string): string {
  const where = country ? ` (${country})` : '';
  if (n === 0) return `none apply to this address${where}`;
  return `${n.toLocaleString()} ${n === 1 ? 'applies' : 'apply'} to this address${where}`;
}

// v2 rate-table.tsx:35,96-99 BLEED and components lib/current-row.ts:10-13 currentRowMark(true): a 2 px primary bar on
// bg-muted, bled to the sheet's edge. TallyUI's TableRow has no `selected`, so the mark is classes.
const MARKED_ROW = '-mx-4 border-l-2 border-l-primary bg-muted pl-3.5 pr-4';

// v2 tax-rates/rate-rows.ts:23-30: the name's second line, only when the booleans say something.
export function rateTags(rate: Pick<StoreTaxRate, 'compound' | 'shipping'>): string {
  return [rate.compound ? 'Compound' : null, rate.shipping === false ? 'Not on shipping' : null].filter(Boolean).join(' · ');
}

function locationField(value: string | readonly string[] | undefined): string | null {
  return (typeof value === 'string' ? value : value?.join(', ')) || null;
}

// v2 rate-rows.ts:32-42: the phone row's location line.
export function phoneLocation(rate: Pick<StoreTaxRate, 'location'>): string {
  const country = locationField(rate.location.country) ?? 'Any';
  const state = locationField(rate.location.region);
  const postcodes = locationField(rate.location.postcodes);
  const cities = locationField(rate.location.cities);
  if (!state && !postcodes && !cities) return [country, 'any state, postcode or city'].join(' · ');
  return [country, state ?? 'any state', postcodes, cities].filter(Boolean).join(' · ');
}

// v2 rate-rows.ts:44-53: the phone row's tags, then the non-default priority.
export function phoneTags(rate: Pick<StoreTaxRate, 'compound' | 'shipping' | 'priority'>): string {
  const priority = rate.priority ?? 1;
  return [rateTags(rate), priority !== 1 ? `priority ${priority}` : null].filter(Boolean).join(' · ');
}

// v2 rate-rows.ts:14-17: lists joined with ", "; empty means WooCommerce's `*`, which reads a muted "Any" (rate-table.tsx:78-85).
function Location({ value }: { value: string | readonly string[] | undefined }) {
  const shown = locationField(value);
  return shown
    ? <Text numberOfLines={Array.isArray(value) ? 2 : undefined}>{shown}</Text>
    : <Text className="text-muted-foreground">Any</Text>;
}

// v2 rate-table.tsx:41-49: fixed widths by what each column holds; the name takes the rest.
const COLUMNS = {
  country: 'w-14 flex-none', state: 'w-14 flex-none', postcode: 'w-30 flex-none', city: 'w-30 flex-none',
  rate: 'w-18 flex-none items-end', name: 'min-w-0 flex-1', priority: 'w-16 flex-none items-end',
} as const;
const HEADS: Array<[keyof typeof COLUMNS, string]> = [
  ['country', 'Country'], ['state', 'State'], ['postcode', 'Postcode'], ['city', 'City'],
  ['rate', 'Rate'], ['name', 'Name'], ['priority', 'Priority'],
];

// v2 rate-table.tsx:57-183; a phone gets v2's list rows (:87-115). A row is `selected` only when marked (:92-99,148-156).
function TaxRateTable({ rates, appliesTo }: { rates: StoreTaxRate[]; appliesTo: ReadonlySet<string> | null }) {
  const wide = useIsWide();
  // v2 rate-table.tsx:62-70, en core.json tax_rates.none_in_class.
  if (rates.length === 0) return <Text testID="tax-rates-empty" className="p-8 text-center text-muted-foreground">No rates in this class</Text>;
  // v2 rate-table.tsx:87-115 and list-row/index.tsx:54-58: ListRow with px-0; TallyUI has no ListRow.
  if (!wide) return (
    <View testID="tax-rates-list">
      {rates.map(rate => {
        const tags = phoneTags(rate);
        const marked = isApplied(appliesTo, rate);
        return (
          <View key={rate.id} testID={`tax-rates-row-${rate.id}`} aria-selected={marked || undefined}
            className={`min-h-14 flex-row items-center gap-3 border-b border-border py-2 ${marked ? MARKED_ROW : ''}`}>
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1}>{rate.name}</Text>
              <Text testID={`tax-rates-row-${rate.id}-location`} numberOfLines={1} className={SETTINGS_KEY_CLASS}>{phoneLocation(rate)}</Text>
              {tags ? <Text testID={`tax-rates-row-${rate.id}-tags`} className={SETTINGS_HELP_CLASS}>{tags}</Text> : null}
            </View>
            <Text testID={`tax-rates-row-${rate.id}-rate`} className="font-semibold tabular-nums">{ratePercent(rate.rate)}</Text>
          </View>
        );
      })}
    </View>
  );
  return (
    <Table testID="tax-rates-table">
      <TableHeader>
        <TableRow className="gap-3">
          {HEADS.map(([id, label]) => (
            <TableHead key={id} className={`px-0 ${COLUMNS[id]}`}>
              <Text className={id === 'rate' || id === 'priority' ? 'text-right' : undefined}>{label}</Text>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rates.map(rate => {
          const tags = rateTags(rate);
          const marked = isApplied(appliesTo, rate);
          return (
            <TableRow key={rate.id} testID={`tax-rates-row-${rate.id}`} aria-selected={marked || undefined}
              className={marked ? `gap-3 ${MARKED_ROW}` : 'gap-3'}>
              <TableCell className={`px-0 ${COLUMNS.country}`}><Location value={rate.location.country} /></TableCell>
              <TableCell className={`px-0 ${COLUMNS.state}`}><Location value={rate.location.region} /></TableCell>
              <TableCell className={`px-0 ${COLUMNS.postcode}`}><Location value={rate.location.postcodes} /></TableCell>
              <TableCell className={`px-0 ${COLUMNS.city}`}><Location value={rate.location.cities} /></TableCell>
              <TableCell className={`px-0 ${COLUMNS.rate}`}><Text className="text-right tabular-nums">{ratePercent(rate.rate)}</Text></TableCell>
              <TableCell className={`px-0 ${COLUMNS.name}`}>
                <Text>{rate.name}</Text>
                {tags ? <Text className={SETTINGS_HELP_CLASS}>{tags}</Text> : null}
              </TableCell>
              <TableCell className={`px-0 ${COLUMNS.priority}`}>
                <Text className="text-right tabular-nums text-muted-foreground">{rate.priority ?? 1}</Text>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// v2 dialog/index.tsx:76 `side="right" size="2xl"` (w-200), on the app's right sheet (sheet.tsx RIGHT_SHEET).
const SHEET = 'left-auto right-0 top-0 h-full w-full max-w-200 translate-x-0 translate-y-0 gap-4 rounded-none border-0 border-l border-border bg-card p-0 py-4';

// lucide `refresh-cw`, v2's `refresh` icon, as table-surface.tsx's TableCount draws it (not exported there).
const SyncIcon = createSvgIcon('SyncIcon', () => <><Path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><Path d="M21 3v5h-5" />
  <Path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><Path d="M8 16H3v5" /></>);

// v2 tax-rates/tax-rates.tsx: one tab per class, each holding that class's rates. The rates come with the store
// settings, which have no refresh once ready (@tallyui/pos useStoreSettings), so the sync icon is drawn but disabled.
// v2 rate-rows.ts:71-88: opened with the "Tax based on" address (and the table to match it against) the sheet marks the rates
// that apply and counts them; opened from anywhere else, no marks and the plain count.
export function TaxRatesDialog({ rates, taxClassSlugs, onClose, address, rateTable }: {
  rates: StoreTaxRate[] | undefined; taxClassSlugs: string[] | undefined; onClose: () => void;
  address?: TaxAddress; rateTable?: WooTaxRate[];
}): JSX.Element {
  const appliesTo = useMemo(() => (address && rateTable ? matchedRateIds(rateTable, address) : null), [address, rateTable]);
  // v2 tax-rates.tsx:111-119: classes in the store's order; a rate with no class is WooCommerce's standard.
  const groups = [{ id: 'standard', label: 'Standard' }, ...taxClassOptions(taxClassSlugs)].map(({ id, label }) => ({
    slug: id, name: label, rates: (rates ?? []).filter(rate => (rate.taxClass || 'standard') === id),
  }));
  const [value, setValue] = useState(groups[0]!.slug);
  const wide = useIsWide();
  const current = groups.find(group => group.slug === value) ?? groups[0]!;
  const count = rates?.length ?? 0;
  const applied = (rates ?? []).filter(rate => isApplied(appliesTo, rate)).length;
  return (
    <Dialog open onOpenChange={next => { if (!next) onClose(); }}>
      <DialogContent testID="tax-rates-dialog" className={SHEET}>
        {/* v2 dialog/index.tsx:238-246: DialogHeader `pl-4 pr-ctl`, the title at the dialog rank (SHEET_TITLE). v2's string
            is "Tax rates" (core.json:1928); the demo's "Tax Rates" wins. */}
        <DialogHeader className="pl-4 pr-11"><DialogTitle testID="tax-rates-title" className={SHEET_TITLE}>Tax Rates</DialogTitle></DialogHeader>
        {/* v2 dialog/index.tsx:213-233: the header × is an absolute h-ctl square at top-1 right-1, an 18 px glyph. */}
        <View className="absolute right-1 top-1">
          <IconButton variant="ghost" className="h-11 w-11" testID="tax-rates-close-x" accessibilityLabel="Close" onPress={onClose}><XIcon size={18} /></IconButton>
        </View>
        {/* v2 tax-rates.tsx:145-152: a min-h-0 flex-1 View round the Tabs (TallyUI's Tabs root takes no className). */}
        <View className="min-h-0 flex-1"><Tabs value={value} onValueChange={setValue}>
          {wide ? (
            // v2 tax-rates.tsx:167-173 and tabs/index.tsx:126,281-287: a ScrollableTabsList, whose `mx-4` list sits in
            // 8 px of scroll padding (24 px in all) and is only as wide as its tabs, so its `border-b` rule runs under
            // the tabs only (`self-start`). TallyUI's TabsList is a muted box (no underline variant in 3.18.0), so the
            // classes clear it.
            <TabsList testID="tax-rates-tablist"
              className="mx-6 h-auto flex-row items-end justify-start gap-1 self-start rounded-none border-b border-border bg-transparent p-0">
              {/* v2 tax-rates.tsx:122-134: the count is its own Text, inline after the class name. */}
              {groups.map(group => (
                <TabsTrigger key={group.slug} value={group.slug} testID={`tax-rates-tab-${group.slug}`}
                  // v2 tabs/index.tsx:341-346: h-ctl, -mb-px, a 2 px underline, primary when active and transparent when not.
                  className={`-mb-px h-11 flex-row gap-1 rounded-none border-b-2 bg-transparent px-3 py-0 shadow-none ${group.slug === value ? 'border-primary' : 'border-transparent'}`}>
                  <Text>{group.name}</Text>
                  <Text className="font-normal tabular-nums text-muted-foreground">{group.rates.length}</Text>
                </TabsTrigger>
              ))}
            </TabsList>
          ) : (
            // v2 tax-rates.tsx:158-165: a phone folds the strip into a Select. TallyUI's TabsList has no `asSelect`.
            <View className="mx-4">
              <Select value={{ value: current.slug, label: `${current.name} ${current.rates.length}` }}
                onValueChange={option => { if (option) setValue(option.value); }}>
                <SelectTrigger testID="tax-rates-class-select" className={SELECT_FACE} chevron={false}>
                  <SelectValue placeholder="" />
                  <ChevronDownIcon size={16} className="text-muted-foreground" />
                </SelectTrigger>
                <SelectContent><SelectGroup>
                  {groups.map(group => <SelectItem key={group.slug} value={group.slug} label={`${group.name} ${group.rates.length}`}
                    testID={`tax-rates-tab-${group.slug}`}><Text>{`${group.name} ${group.rates.length}`}</Text></SelectItem>)}
                </SelectGroup></SelectContent>
              </Select>
            </View>
          )}
          {groups.map(group => (
            <TabsContent key={group.slug} value={group.slug} className="min-h-0 flex-1">
              <ScrollView className="flex-1" contentContainerClassName="px-4"><TaxRateTable rates={group.rates} appliesTo={appliesTo} /></ScrollView>
            </TabsContent>
          ))}
        </Tabs></View>
        {/* v2 tax-rates.tsx:185-196 and footer.tsx:50-62: the count left, Close right; a phone stacks it. */}
        <DialogFooter className={`gap-2 border-t border-border px-4 pt-4 ${wide
          ? 'flex-row items-center justify-between sm:flex-row sm:justify-between' : 'flex-col sm:flex-col'}`}>
          {/* v2 footer.tsx:54-63: the count (then the applies count, :56-61), then the SyncButton in a `min-w-0 gap-1` row. sync-button.tsx:39-53 is
              an `xs` IconButton (icon-button/index.tsx:27 `size-6`; icon/index.tsx:28 a `size-3.5` glyph, :93 muted). */}
          <View className="min-w-0 shrink flex-row items-center gap-1">
            <Text testID="tax-rates-count" className={`min-w-0 shrink ${SETTINGS_KEY_CLASS}`}>
              {[count === 1 ? '1 tax rate' : `${count.toLocaleString()} tax rates`,
                address && appliesTo ? appliesCount(applied, address.country) : null].filter(Boolean).join(' · ')}
            </Text>
            {/* Disabled, as TableCount is with no `onSync`: nothing here can refresh the rates. */}
            <IconButton testID="tax-rates-sync" accessibilityLabel="Sync" variant="ghost" size="sm" className="h-6 w-6" disabled>
              <SyncIcon size={14} className="text-muted-foreground" />
            </IconButton>
          </View>
          <SheetCloseButton testID="tax-rates-close" onPress={onClose} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
