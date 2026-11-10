// v2's always-visible catalogue filter chips (WCPOS monorepo
// `packages/core/src/screens/main/pos/products/filter-bar/filter-bar.tsx`): Stock status, On Sale,
// Category and Tag, in v2's `BUILT_IN_PILL_IDS` order without Featured and Brand, which need
// connector data this app does not sync yet.
import type { ComponentType, JSX } from 'react';
import { Pressable, View } from 'react-native';
import { Circle, Path, Rect } from 'react-native-svg';
import { createSvgIcon, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, Text, XIcon } from '@tallyui/components';
import type { SvgIconProps } from '@tallyui/components';
import type { CatalogueFilters, QuickFilterStockStatus } from '../lib/catalogue/quick-filters';

const WarehouseIcon = createSvgIcon('WarehouseIcon', () => <>
  <Path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z" />
  <Path d="M6 18h12" />
  <Path d="M6 14h12" />
  <Rect x={6} y={10} width={12} height={12} />
</>);
const CurrencyIcon = createSvgIcon('CurrencyIcon', () => <>
  <Circle cx={12} cy={12} r={10} />
  <Path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
  <Path d="M12 18V6" />
</>);
const FolderIcon = createSvgIcon('FolderIcon', () => <>
  <Path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
</>);

const STOCK_LABELS: Record<QuickFilterStockStatus, string> = { instock: 'In Stock', outofstock: 'Out of Stock', onbackorder: 'On Backorder' };

/** v2's chip: fully rounded, primary ink and a light primary fill when on. */
export function filterChipClassName(active: boolean): string {
  return 'h-9 flex-row items-center gap-1.5 self-start rounded-full border px-3 ' + (active ? 'border-primary bg-primary/10' : 'border-border bg-card');
}

export function filterChipTextClassName(active: boolean): string {
  return 'text-base ' + (active ? 'text-primary' : 'text-foreground');
}

/** A copy of the filters with the key deleted: a key set to `undefined` would still hide every product. */
function without(filters: CatalogueFilters, field: keyof CatalogueFilters): CatalogueFilters {
  const next = { ...filters };
  delete next[field];
  return next;
}

interface ChipOption { value: string; label: string; testID: string }

/** The distinct terms the synced products carry, by name. */
export function termOptions(products: any[], field: 'categories' | 'tags', prefix: string): ChipOption[] {
  const names = new Map<number, string>();
  for (const doc of products) {
    if (!Array.isArray(doc[field])) continue;
    for (const term of doc[field] as { id: number; name: string }[]) if (!names.has(term.id)) names.set(term.id, term.name);
  }
  return [...names].sort(([, a], [, b]) => a.localeCompare(b))
    .map(([id, name]) => ({ value: String(id), label: name, testID: `${prefix}-option-${id}` }));
}

function SelectChip({ field, icon: Icon, active, label, extra, selected, options, emptyText, onChoose, onRemove }: {
  field: 'stock_status' | 'categories' | 'tags';
  icon: ComponentType<SvgIconProps>;
  active: boolean;
  label: string;
  extra: number;
  selected: { value: string; label: string } | undefined;
  options: ChipOption[];
  emptyText?: string;
  onChoose(value: string): void;
  onRemove(): void;
}): JSX.Element {
  return <View className={filterChipClassName(active)}>
    <Select value={selected} onValueChange={option => { if (option) onChoose(option.value); }}>
      <SelectTrigger testID={`filter-pill-${field}`} className="h-auto w-auto justify-start gap-1.5 rounded-none border-0 bg-transparent px-0 py-0">
        <Icon size={16} />
        <Text className={filterChipTextClassName(active)}>{label}</Text>
        {extra > 0 && <Text className={filterChipTextClassName(active)}>{`+${extra}`}</Text>}
      </SelectTrigger>
      <SelectContent><SelectGroup>
        {options.length === 0 && emptyText ? <Text>{emptyText}</Text> : options.map(option =>
          <SelectItem key={option.value} value={option.value} label={option.label} testID={option.testID}><Text>{option.label}</Text></SelectItem>)}
      </SelectGroup></SelectContent>
    </Select>
    {active && <Pressable testID={`filter-pill-remove-${field}`} role="button" accessibilityLabel="Remove" hitSlop={8}
      onPress={onRemove}><XIcon size={14} /></Pressable>}
  </View>;
}

export interface CatalogueFilterChipsProps {
  products: any[];
  filters: CatalogueFilters;
  onChange(next: CatalogueFilters): void;
}

export function CatalogueFilterChips({ products, filters, onChange }: CatalogueFilterChipsProps): JSX.Element {
  const stock = filters.stock_status;
  const stockLabel = stock !== undefined && stock in STOCK_LABELS ? STOCK_LABELS[stock] : undefined;
  const onSale = filters.on_sale === true;
  function termChip(field: 'categories' | 'tags', prefix: string, baseLabel: string, emptyText: string): JSX.Element {
    const options = termOptions(products, field, prefix);
    const ids = filters[field] ?? [];
    const firstId = ids[0];
    const label = firstId === undefined ? baseLabel : options.find(option => option.value === String(firstId))?.label ?? `#${firstId}`;
    return <SelectChip field={field} icon={FolderIcon} active={ids.length > 0} label={label} extra={Math.max(ids.length - 1, 0)}
      selected={firstId === undefined ? undefined : { value: String(firstId), label }} options={options} emptyText={emptyText}
      onChoose={value => onChange({ ...filters, [field]: [Number(value)] })} onRemove={() => onChange(without(filters, field))} />;
  }
  return <View testID="filter-chips" className="flex-row flex-wrap items-center gap-2">
    <SelectChip field="stock_status" icon={WarehouseIcon} active={'stock_status' in filters} label={stockLabel ?? 'Stock Status'} extra={0}
      selected={stockLabel === undefined ? undefined : { value: stock!, label: stockLabel }}
      options={(Object.keys(STOCK_LABELS) as QuickFilterStockStatus[]).map(value => ({ value, label: STOCK_LABELS[value], testID: `stock-status-option-${value}` }))}
      onChoose={value => onChange({ ...filters, stock_status: value as QuickFilterStockStatus })}
      onRemove={() => onChange(without(filters, 'stock_status'))} />
    <Pressable testID="filter-pill-on_sale" role="button" aria-pressed={onSale} className={filterChipClassName(onSale)}
      onPress={() => onChange(onSale ? without(filters, 'on_sale') : { ...filters, on_sale: true })}>
      <CurrencyIcon size={16} />
      <Text className={filterChipTextClassName(onSale)}>On Sale</Text>
    </Pressable>
    {termChip('categories', 'category', 'Category', 'No category found')}
    {termChip('tags', 'tag', 'Tag', 'No tag found')}
  </View>;
}
