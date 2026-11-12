import { useState, type JSX } from 'react';
import { ScrollView, View } from 'react-native';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Select, SelectContent, SelectGroup, SelectItem,
  SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList,
  TabsTrigger, Text,
} from '@tallyui/components';
import type { StoreTaxRate } from '@tallyui/core';
import { useIsWide } from '../../lib/layout/wide';
import { taxClassOptions } from '../../lib/sale/tax-classes';
import { SheetCloseButton } from '../catalogue-display-options';
import { ChevronDownIcon, SELECT_FACE } from '../select-chevron';
import { SETTINGS_HELP_CLASS, SETTINGS_KEY_CLASS } from './settings-form';

// WooCommerce sends rates as 4-decimal strings: "10.0000" reads 10%, "8.2500" 8.25%.
export function ratePercent(rate: string): string {
  const trimmed = rate.includes('.') ? rate.replace(/0+$/, '').replace(/\.$/, '') : rate;
  return `${trimmed}%`;
}

// v2 tax-rates/rate-rows.ts:23-30: the name's second line, only when the booleans say something.
export function rateTags(rate: Pick<StoreTaxRate, 'compound' | 'shipping'>): string {
  return [rate.compound ? 'Compound' : null, rate.shipping === false ? 'Not on shipping' : null].filter(Boolean).join(' · ');
}

// v2 rate-rows.ts:14-17: lists joined with ", "; empty means WooCommerce's `*`, which reads a muted "Any" (rate-table.tsx:78-85).
function Location({ value }: { value: string | readonly string[] | undefined }) {
  const shown = Array.isArray(value) ? value.join(', ') : value;
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

// v2 rate-table.tsx:57-183, without the phone rows and the "applies" marks.
function TaxRateTable({ rates }: { rates: StoreTaxRate[] }) {
  // v2 rate-table.tsx:62-70, en core.json tax_rates.none_in_class.
  if (rates.length === 0) return <Text testID="tax-rates-empty" className="p-8 text-center text-muted-foreground">No rates in this class</Text>;
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
          return (
            <TableRow key={rate.id} testID={`tax-rates-row-${rate.id}`} className="gap-3">
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

// v2 dialog/index.tsx:76 `side="right" size="2xl"` (w-200), on the app's right sheet (catalogue-display-options RIGHT_SHEET).
const SHEET = 'left-auto right-0 top-0 h-full w-full max-w-200 translate-x-0 translate-y-0 gap-4 rounded-none border-0 border-l border-border bg-card p-0 py-4';

// v2 tax-rates/tax-rates.tsx: one tab per class, each holding that class's rates; display only, no sync.
export function TaxRatesDialog({ rates, taxClassSlugs, onClose }: {
  rates: StoreTaxRate[] | undefined; taxClassSlugs: string[] | undefined; onClose: () => void;
}): JSX.Element {
  // v2 tax-rates.tsx:111-119: classes in the store's order; a rate with no class is WooCommerce's standard.
  const groups = [{ id: 'standard', label: 'Standard' }, ...taxClassOptions(taxClassSlugs)].map(({ id, label }) => ({
    slug: id, name: label, rates: (rates ?? []).filter(rate => (rate.taxClass || 'standard') === id),
  }));
  const [value, setValue] = useState(groups[0]!.slug);
  const wide = useIsWide();
  const current = groups.find(group => group.slug === value) ?? groups[0]!;
  const count = rates?.length ?? 0;
  return (
    <Dialog open onOpenChange={next => { if (!next) onClose(); }}>
      <DialogContent testID="tax-rates-dialog" className={SHEET}>
        <DialogHeader className="px-4"><DialogTitle>Tax rates</DialogTitle></DialogHeader>
        {/* v2 tax-rates.tsx:145-152: a min-h-0 flex-1 View round the Tabs (TallyUI's Tabs root takes no className). */}
        <View className="min-h-0 flex-1"><Tabs value={value} onValueChange={setValue}>
          {wide ? (
            <TabsList className="mx-4 flex-row self-start">
              {/* v2 tax-rates.tsx:122-134: the count is its own Text, outside the class name. */}
              {groups.map(group => (
                <TabsTrigger key={group.slug} value={group.slug} testID={`tax-rates-tab-${group.slug}`} className="gap-1">
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
                <SelectTrigger testID="tax-rates-class-select" className={SELECT_FACE}>
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
              <ScrollView className="flex-1" contentContainerClassName="px-4"><TaxRateTable rates={group.rates} /></ScrollView>
            </TabsContent>
          ))}
        </Tabs></View>
        {/* v2 tax-rates.tsx:185-196 and footer.tsx:50-62: the count left, Close right; a phone stacks it. */}
        <DialogFooter className={`gap-2 border-t border-border px-4 pt-4 ${wide
          ? 'flex-row items-center justify-between sm:flex-row sm:justify-between' : 'flex-col sm:flex-col'}`}>
          <Text testID="tax-rates-count" className={`min-w-0 shrink ${SETTINGS_KEY_CLASS}`}>
            {count === 1 ? '1 tax rate' : `${count.toLocaleString()} tax rates`}
          </Text>
          <SheetCloseButton testID="tax-rates-close" onPress={onClose} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
