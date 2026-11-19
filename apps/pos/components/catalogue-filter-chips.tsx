// v2's always-visible catalogue filter chips (WCPOS monorepo
// `packages/core/src/screens/main/pos/products/filter-bar/filter-bar.tsx`): Stock status, On Sale,
// Category and Tag, in v2's `BUILT_IN_PILL_IDS` order without Featured and Brand, which need
// connector data this app does not sync yet.
import { useRef, useState } from 'react';
import type { ComponentType, JSX, ReactElement, ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Circle, Path, Rect } from 'react-native-svg';
import {
  Combobox, ComboboxItem, createSvgIcon, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Select, SelectContent, SelectGroup,
  SelectItem, SelectTrigger, Text, Tooltip, TooltipContent, TooltipTrigger, XIcon,
} from '@tallyui/components';
import type { SvgIconProps } from '@tallyui/components';
import { Combobox as ComboboxPrimitive, Popover } from '@tallyui/primitives';
import type { BuiltInPillId } from '../lib/catalogue/filter-bar-pills';
import type { CatalogueFilters, QuickFilterStockStatus } from '../lib/catalogue/quick-filters';
import { FiltersIcon, FolderIcon } from './icons';

export const WarehouseIcon = createSvgIcon('WarehouseIcon', () => <>
  <Path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z" />
  <Path d="M6 18h12" />
  <Path d="M6 14h12" />
  <Rect x={6} y={10} width={12} height={12} />
</>);
export const CurrencyIcon = createSvgIcon('CurrencyIcon', () => <>
  <Circle cx={12} cy={12} r={10} />
  <Path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
  <Path d="M12 18V6" />
</>);

const STOCK_LABELS: Record<QuickFilterStockStatus, string> = { instock: 'In Stock', outofstock: 'Out of Stock', onbackorder: 'On Backorder' };

/** v2's Chip tone, the one source for every chip here (monorepo packages/components/src/chip/index.tsx:163): on, the
 *  selected tint as fill and border, so the border keeps its width but is not seen; off, the card with a border. */
export function chipToneClassName(on: boolean): string {
  return on ? 'border-selected bg-selected' : 'border-border bg-card';
}

/** v2's one ink for a chip's icon, label and clear (chip/index.tsx:106, through TextClassContext). */
export function chipInkClassName(on: boolean): string {
  return on ? 'text-selected-foreground' : 'text-foreground';
}

/** v2's chip: fully rounded, the tone above; v2's Chip `dimmed` is `opacity-45`.
 *  `h-11` is the default Chip's `h-ctl px-3`, 44 px (monorepo packages/components/src/chip/index.tsx:158). */
export function filterChipClassName(active: boolean, dimmed = false): string {
  return 'h-11 flex-row items-center gap-1.5 self-start rounded-full border px-3 ' + chipToneClassName(active)
    + (dimmed ? ' opacity-45' : '');
}

export function filterChipTextClassName(active: boolean): string {
  return 'text-base ' + chipInkClassName(active);
}

/** An on chip's icon and clear take its ink (chip/index.tsx:106); an off chip's icon keeps its own. */
const chipGlyphClassName = (on: boolean) => (on ? chipInkClassName(true) : undefined);

/** v2's clear cell (chip/index.tsx:211-222): the chip's height square (`min-w-ctl`, 44 px = `h-11`), spanning its
 *  height, and `-mr-3` cancels the chip's `px-3` end padding. Shared by every filter chip with a clear. */
export const CHIP_CLEAR_CELL_CLASS = 'min-w-11 -mr-3 items-center justify-center self-stretch';
/** v2's clear mark, `<Icon name="close" size="sm" />` (chip/index.tsx:239; icon/index.tsx:29 `sm` is `size-4`). */
export const CHIP_CLEAR_GLYPH_SIZE = 16;

/** v2's tooltip on a dimmed chip (core en.json `pos_products.product_filter_not_in_variations`). */
const DIMMED_CHIP_TOOLTIP = 'A product filter; not used inside a product’s variations.';

/** v2's dimmed slot (filter-bar.tsx:182-191): the dimmed chip is the trigger of a tooltip that says why it is off,
 *  with no menu around it. The chip stays disabled, as v2's Chip `dimmed` is, so a press reaches nothing; v2's web
 *  tooltip opens on hover, and TallyUI's opens only on a press, so the slot opens it as the pointer enters and
 *  closes it as the pointer leaves, through the trigger's own open and close (which place the content). */
export function DimmedChipTooltip({ children }: { children: ReactElement }): JSX.Element {
  const trigger = useRef<View & { open?(): void; close?(): void }>(null);
  return <View onPointerEnter={() => trigger.current?.open?.()} onPointerLeave={() => trigger.current?.close?.()}>
    <Tooltip>
      <TooltipTrigger ref={trigger} asChild>{children}</TooltipTrigger>
      <TooltipContent><Text>{DIMMED_CHIP_TOOLTIP}</Text></TooltipContent>
    </Tooltip>
  </View>;
}

/** v2's BarSlot (filter-bar.tsx:141-251): a long press opens the chip's menu from a hidden trigger laid over the chip. */
export function LongPressMenu({ chip, children }: { chip(onLongPress: () => void): JSX.Element; children: ReactNode }): JSX.Element {
  const trigger = useRef<View & { open?(): void }>(null);
  return <View className="relative">
    <DropdownMenu>
      {chip(() => trigger.current?.open?.())}
      <DropdownMenuTrigger ref={trigger} className="absolute inset-0" pointerEvents="none" tabIndex={-1} aria-hidden />
      <DropdownMenuContent>{children}</DropdownMenuContent>
    </DropdownMenu>
  </View>;
}

/** v2's Customise row, on every chip's menu (filter-bar.tsx:233-240, core en.json:1238). */
export function CustomiseMenuItem({ id, onPress }: { id: string; onPress(): void }): JSX.Element {
  return <DropdownMenuItem testID={`filter-bar-menu-customize-${id}`} className="gap-2" onPress={onPress}>
    <FiltersIcon size={18} strokeWidth={1.5} className="text-foreground" /><Text>Customise filter bar</Text></DropdownMenuItem>;
}

/** v2's built-in chip menu (filter-bar.tsx:215-240): Hide from bar, then Customise filter bar. */
export type PillMenu = { onHide(id: BuiltInPillId): void; onCustomise(): void };

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

/** v2's search box copy for the term chips (core en.json:771 common.search_categories, :779 common.search_tags). */
const TERM_SEARCH = { categories: 'Search Categories', tags: 'Search Tags' } as const;

/** v2's term chip menu (filter-bar.tsx:344-381, collection-search.tsx:74-86): a search box over the terms, narrowing
 *  by name, and the empty copy on a miss. Flat: v2's category tree needs parent data the connector does not sync.
 *  The primitives' Popover anchors it under the chip (TallyUI's ComboboxContent does no positioning), and its
 *  overlay closes it on an outside press, as menu-chip.tsx does; v2's panel is `max-h-75 w-80` (combobox.tsx:183). */
function TermSearchMenu({ field, options, selected, emptyText, search, onChoose, onLongPress, children }: {
  field: 'categories' | 'tags'; options: ChipOption[]; selected: { value: string; label: string } | undefined;
  emptyText?: string; search: string; onChoose(value: string): void; onLongPress?(): void; children: ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const toggle = (next: boolean) => { setOpen(next); if (!next) setText(''); };
  const term = text.trim().toLowerCase();
  const shown = options.filter(option => option.label.toLowerCase().includes(term));
  return <Popover.Root open={open} onOpenChange={toggle}>
    <Popover.Trigger asChild>
      <Pressable testID={`filter-pill-${field}`} role="button" className="flex-row items-center gap-1.5" onLongPress={onLongPress}>{children}</Pressable>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Overlay testID={`filter-pill-${field}-overlay`} style={StyleSheet.absoluteFill} />
      <Popover.Content testID={`filter-pill-${field}-menu`} align="start" sideOffset={4}
        className="z-50 max-h-75 w-80 rounded-md border border-border bg-popover p-1 shadow-md outline-none">
        {/* Inside the portal: the primitives' Portal carries only the Popover's own context across. */}
        <Combobox value={selected} onValueChange={option => { if (option) onChoose(option.value); }}
          open={open} onOpenChange={toggle} searchValue={text} onSearchValueChange={setText}>
          {/* v2's ComboboxInput: focused on open, `mb-2` above the rows (combobox.tsx:238-245), a 44 field. The unstyled
              primitive: TallyUI's styled one adds `flex-1`, which folds the field's height in this column. */}
          <ComboboxPrimitive.Input asChild placeholder={search}>
            <TextInput testID={`filter-pill-${field}-search`} autoFocus placeholderTextColorClassName="accent-muted-foreground"
              className="mb-2 h-11 rounded-md border border-border px-3 text-base text-foreground web:outline-none" />
          </ComboboxPrimitive.Input>
          {shown.length ? shown.map(option => <ComboboxItem key={option.value} value={option.value} label={option.label}
            testID={option.testID}><Text>{option.label}</Text></ComboboxItem>)
            /* v2's ComboboxEmpty row (combobox.tsx:312-317); TallyUI's prints fixed copy. */
            : <Text testID={`filter-pill-${field}-empty`} className="px-2 py-1.5 text-base">{emptyText}</Text>}
        </Combobox>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}

function SelectChip({ field, icon: Icon, active, dimmed = false, label, extra, selected, options, emptyText, search, onChoose, onRemove, onLongPress }: {
  field: 'stock_status' | 'categories' | 'tags';
  icon: ComponentType<SvgIconProps>;
  active: boolean;
  dimmed?: boolean;
  label: string;
  extra: number;
  selected: { value: string; label: string } | undefined;
  options: ChipOption[];
  emptyText?: string;
  /** The term chips' search box copy: a searchable menu in place of the plain Select. */
  search?: string;
  onChoose(value: string): void;
  onRemove(): void;
  /** Opens the chip's menu; react-native-web drops the press after a long press, so the Select stays shut. */
  onLongPress?(): void;
}): JSX.Element {
  // v2's DimmedChip: a dimmed chip is a plain chip with its label and no menu, the tooltip's trigger itself.
  if (dimmed) return <DimmedChipTooltip>
    <Pressable testID={`filter-pill-${field}`} role="button" disabled className={filterChipClassName(active, true)}>
      <Icon size={16} className={chipGlyphClassName(active)} />
      <Text className={filterChipTextClassName(active)}>{label}</Text>
      {extra > 0 && <Text className={filterChipTextClassName(active)}>{`+${extra}`}</Text>}
    </Pressable>
  </DimmedChipTooltip>;
  const face = <>
    <Icon size={16} className={chipGlyphClassName(active)} />
    <Text className={filterChipTextClassName(active)}>{label}</Text>
    {extra > 0 && <Text className={filterChipTextClassName(active)}>{`+${extra}`}</Text>}
  </>;
  return <View className={filterChipClassName(active)}>
    {search && field !== 'stock_status' ? <TermSearchMenu field={field} options={options} selected={selected} emptyText={emptyText}
      search={search} onChoose={onChoose} onLongPress={onLongPress}>{face}</TermSearchMenu> : <Select value={selected} onValueChange={option => { if (option) onChoose(option.value); }}>
      {/* v2's filter chips draw no chevron (filter-bar). */}
      <SelectTrigger testID={`filter-pill-${field}`} chevron={false} onLongPress={onLongPress} className="h-auto w-auto justify-start gap-1.5 rounded-none border-0 bg-transparent px-0 py-0">
        {face}
      </SelectTrigger>
      <SelectContent><SelectGroup>
        {options.length === 0 && emptyText ? <Text>{emptyText}</Text> : options.map(option =>
          <SelectItem key={option.value} value={option.value} label={option.label} testID={option.testID}><Text>{option.label}</Text></SelectItem>)}
      </SelectGroup></SelectContent>
    </Select>}
    {/* The clear sits beside the Select's trigger, not in it, so its press never opens the menu. */}
    {active && <Pressable testID={`filter-pill-remove-${field}`} role="button" accessibilityLabel="Remove"
      className={CHIP_CLEAR_CELL_CLASS} onPress={onRemove}>
      <XIcon size={CHIP_CLEAR_GLYPH_SIZE} className={chipGlyphClassName(true)} />
    </Pressable>}
  </View>;
}

export interface CatalogueFilterChipsProps {
  products: any[];
  filters: CatalogueFilters;
  onChange(next: CatalogueFilters): void;
  /** v2's `level === 'variations'` (filter-bar.tsx): while a product is drilled into, every chip but Stock status is
   * dimmed and opens nothing, since a product filter does not apply to its variations. */
  dimmed?: boolean;
  /** v2's `place.field` (filter-bar.tsx:505, `item.id === place?.field` draws nothing): the field an open browse
   * level's crumb owns. The crumb is the place, so that field's own chip folds away; the other chips stay. */
  placeField?: 'categories' | 'tags';
  /** Drawn last in the row: the Products screen's Clear all (v2 components/product/filter-bar/index.tsx:61-65). */
  trailing?: ReactNode;
  /** The built-ins switched off in the Filter bar dialog (v2 filter-bar.tsx:505, `!item.show` draws nothing). */
  hidden?: readonly BuiltInPillId[];
  /** The long-press menu on each chip; the Products screen has none. */
  menu?: PillMenu;
}

export function CatalogueFilterChips({ products, filters, onChange, dimmed = false, placeField, trailing, hidden = [], menu }: CatalogueFilterChipsProps): JSX.Element {
  const stock = filters.stock_status;
  const stockLabel = stock !== undefined && stock in STOCK_LABELS ? STOCK_LABELS[stock] : undefined;
  const onSale = filters.on_sale === true;
  /** v2's BarSlot: a long press opens the chip's menu; a dimmed chip opens nothing (filter-bar.tsx:147-149). */
  function slot(id: BuiltInPillId, chip: (onLongPress?: () => void) => JSX.Element): JSX.Element {
    if (!menu || (dimmed && id !== 'stock_status')) return chip();
    return <LongPressMenu chip={chip}>
      {/* v2's row leads with an eye-off icon (`Icon name="hide"`); the app has none and new icons wait on a licence
          check, so a blank of the icon's size keeps the label in line with Customise's. */}
      <DropdownMenuItem testID={`filter-bar-menu-hide-${id}`} className="gap-2" onPress={() => menu.onHide(id)}>
        <View className="size-[18px]" /><Text>Hide from bar</Text></DropdownMenuItem>
      <CustomiseMenuItem id={id} onPress={menu.onCustomise} />
    </LongPressMenu>;
  }
  function termChip(field: 'categories' | 'tags', prefix: string, baseLabel: string, emptyText: string): JSX.Element | null {
    if (field === placeField) return null;
    const options = termOptions(products, field, prefix);
    const ids = filters[field] ?? [];
    const firstId = ids[0];
    const label = firstId === undefined ? baseLabel : options.find(option => option.value === String(firstId))?.label ?? `#${firstId}`;
    return slot(field, onLongPress => <SelectChip field={field} icon={FolderIcon} active={ids.length > 0} dimmed={dimmed} label={label} extra={Math.max(ids.length - 1, 0)}
      selected={firstId === undefined ? undefined : { value: String(firstId), label }} options={options} emptyText={emptyText} search={TERM_SEARCH[field]}
      onChoose={value => onChange({ ...filters, [field]: [Number(value)] })} onRemove={() => onChange(without(filters, field))} onLongPress={onLongPress} />);
  }
  const onSaleChip = (onLongPress?: () => void) => <Pressable testID="filter-pill-on_sale" role="button" aria-pressed={onSale} disabled={dimmed}
    className={filterChipClassName(onSale, dimmed)} onLongPress={onLongPress}
    onPress={() => onChange(onSale ? without(filters, 'on_sale') : { ...filters, on_sale: true })}>
    <CurrencyIcon size={16} className={chipGlyphClassName(onSale)} />
    <Text className={filterChipTextClassName(onSale)}>On Sale</Text>
  </Pressable>;
  // Both callers (the till's catalogue-chip-row, the Products screen's products-chip-row) draw it in v2's horizontal ChipRow.
  return <View testID="filter-chips" className="flex-row items-center gap-2">
    {!hidden.includes('stock_status') && slot('stock_status', onLongPress => <SelectChip field="stock_status" icon={WarehouseIcon} active={'stock_status' in filters} label={stockLabel ?? 'Stock Status'} extra={0}
      selected={stockLabel === undefined ? undefined : { value: stock!, label: stockLabel }}
      options={(Object.keys(STOCK_LABELS) as QuickFilterStockStatus[]).map(value => ({ value, label: STOCK_LABELS[value], testID: `stock-status-option-${value}` }))}
      onChoose={value => onChange({ ...filters, stock_status: value as QuickFilterStockStatus })}
      onRemove={() => onChange(without(filters, 'stock_status'))} onLongPress={onLongPress} />)}
    {!hidden.includes('on_sale') && (dimmed ? <DimmedChipTooltip>{onSaleChip()}</DimmedChipTooltip> : slot('on_sale', onSaleChip))}
    {!hidden.includes('categories') && termChip('categories', 'category', 'Category', 'No category found')}
    {!hidden.includes('tags') && termChip('tags', 'tag', 'Tag', 'No tag found')}
    {trailing}
  </View>;
}
