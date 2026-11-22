// v2's CaptureQuickFilter (monorepo packages/core/src/screens/main/pos/products/filter-bar/capture-quick-filter.tsx).
import { useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { moneyFromMajor } from '@tallyui/core';
import { useFormatStoreMoney } from '../lib/money/store-money';
import { Checkbox, Input, SearchIcon, Text } from '@tallyui/components';
import { createQuickFilterId, describeQuickFilter, QUICK_FILTER_CONDITION_FIELDS } from '../lib/catalogue/quick-filters';
import type { CapturedQuickFilter, QuickFilter, QuickFilterConditionField } from '../lib/catalogue/quick-filters';
import { ArrowDownIcon, CategoryIcon, CurrencyIcon, GridIcon, TagIcon, WarehouseIcon } from './icons';

const KIND_ICONS = { categories: CategoryIcon, tags: TagIcon, price: CurrencyIcon, on_sale: CurrencyIcon, stock_status: WarehouseIcon, type: GridIcon, search: SearchIcon, sort: ArrowDownIcon };
// v2's NAMED_ORDERS (filter-bar-layout.ts:228-275) the app's sort fields can reach; the rest read "<field> ↑|↓".
const NAMED_ORDERS: Record<string, string> = { 'name-asc': 'Name, A to Z', 'name-desc': 'Name, Z to A', 'price-asc': 'Price, low to high', 'price-desc': 'Price, high to low' };

export function CaptureQuickFilter({ captured, products, currency, onDraftChange }: {
  captured: CapturedQuickFilter;
  products: any[];
  currency: string;
  onDraftChange(draft: QuickFilter): void;
}): JSX.Element {
  const formatMoney = useFormatStoreMoney();
  // As v2 (capture-quick-filter.tsx:32-37): the search and the sort start unticked.
  const [draft, setDraft] = useState<QuickFilter>(() => ({ id: createQuickFilterId(), type: 'quick', label: '',
    conditions: captured.conditions.filter(condition => condition.field !== 'search') }));
  const change = (next: QuickFilter) => { setDraft(next); onDraftChange(next); };
  const formatPrice = (value: number) => { const money = moneyFromMajor(value, currency); return (money && formatMoney(money)) ?? String(value); };
  // Term names from the synced products, as the editor reads them (WooCommerce term ids are unique across taxonomies).
  const termNames = new Map<number, string>(products.flatMap(doc => [...(doc.categories ?? []), ...(doc.tags ?? [])]).map(term => [term.id, term.name]));
  const line = (field: QuickFilterConditionField | 'sort', checked: boolean, body: string, toggle: () => void) => {
    const Glyph = KIND_ICONS[field];
    return <Pressable key={field} testID={`quick-filter-capture-${field}`} role="checkbox" aria-checked={checked} onPress={toggle}
      className="min-h-11 flex-row items-center gap-3 px-3 py-2 web:hover:bg-muted active:bg-muted">
      <View pointerEvents="none" className="flex-row items-center gap-3">
        <Checkbox checked={checked} onCheckedChange={toggle} tabIndex={-1} />
        <Glyph size={18} className="text-muted-foreground" />
      </View>
      <Text className={field === 'sort' ? 'flex-1 text-muted-foreground' : 'flex-1'}>{body}</Text>
    </Pressable>;
  };
  const rows: ReactNode[] = QUICK_FILTER_CONDITION_FIELDS.flatMap(field => {
    const condition = captured.conditions.find(entry => entry.field === field);
    if (!condition) return [];
    const checked = draft.conditions.some(entry => entry.field === field);
    const body = condition.field === 'categories' || condition.field === 'tags'
      ? `${condition.field === 'categories' ? 'In category' : 'Tagged'}: ${condition.value.map(id => termNames.get(id) ?? `#${id}`).join(', ')}`
      : describeQuickFilter({ ...draft, conditions: [condition], sort: undefined }, formatPrice);
    return [line(field, checked, body, () => change({ ...draft,
      conditions: checked ? draft.conditions.filter(entry => entry.field !== field) : [...draft.conditions, condition] }))];
  });
  return <View className="gap-4">
    <View className="gap-1">
      <Text>Button name</Text>
      <Input><Input.Field testID="quick-filter-name" placeholder="e.g. Sale wines" accessibilityLabel="Button name" autoFocus
        value={draft.label} onChangeText={label => change({ ...draft, label })} /></Input>
    </View>
    <View>
      <Text className="font-medium">Keeps what is on screen now</Text>
      {rows}
      {captured.sort && line('sort', draft.sort !== undefined, `Ordered by ${NAMED_ORDERS[`${captured.sort.field}-${captured.sort.dir}`]
        ?? describeQuickFilter({ ...draft, conditions: [], sort: captured.sort }, formatPrice).replace('Sort: ', '')} (the grid's order right now)`,
        () => change({ ...draft, sort: draft.sort ? undefined : captured.sort }))}
    </View>
  </View>;
}
