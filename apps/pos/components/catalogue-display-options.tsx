// v2's Product settings side sheet (WCPOS monorepo `packages/core/src/screens/main/pos/products/ui-settings-form.tsx`).
import { useState } from 'react';
import type { JSX } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Path } from 'react-native-svg';
import { Button, createSvgIcon, Dialog, DialogContent, DialogTitle, IconButton, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, Slider, Switch, Text, XIcon } from '@tallyui/components';
import type { ProductSort } from '@tallyui/pos';
import { BROWSE_BY, CATALOGUE_COLUMNS, CATALOGUE_TILE_FIELDS, CATALOGUE_VIEW_DEFAULTS } from '../lib/catalogue/catalogue-view-state';
import type { AppCatalogueViewState, PanelPosition } from '../lib/catalogue/catalogue-view-state';
import { QUICK_FILTER_SORT_FIELDS } from '../lib/catalogue/quick-filters';
import { termOptions } from './catalogue-filter-chips';

const CheckIcon = createSvgIcon('CheckIcon', () => <Path d="M20 6 9 17l-5-5" />);

const RIGHT_SHEET = 'left-auto right-0 top-0 h-full w-full max-w-lg translate-x-0 translate-y-0 gap-4 rounded-none border-0 border-l border-border bg-card p-0 py-4';
const LEFT_SHEET = 'left-0 right-auto top-0 h-full w-full max-w-lg translate-x-0 translate-y-0 gap-4 rounded-none border-0 border-r border-border bg-card p-0 py-4';

export function settingsSheetClassName(position: PanelPosition): string {
  // v2's usePanelSide('products'): the sheet slides in over the cart.
  return position === 'left' ? RIGHT_SHEET : LEFT_SHEET;
}

const SORT_LABELS: Record<(typeof QUICK_FILTER_SORT_FIELDS)[number], string> = { name: 'Name', sku: 'SKU', barcode: 'Barcode', price: 'Price', stock: 'Stock Quantity' };

function countLabel(count: number, one: string, many: string): string { return `${count} ${count === 1 ? one : many}`; }

function FieldLabel({ children }: { children: string }): JSX.Element { return <Text className="text-sm font-medium text-foreground">{children}</Text>; }

/** v2's FormSwitch: the switch first, then a label that fills the row and toggles the switch when pressed. */
function SwitchRow({ label, testID, accessibilityLabel, checked, disabled, onCheckedChange }: {
  label: string; testID: string; accessibilityLabel: string; checked: boolean; disabled?: boolean; onCheckedChange(next: boolean): void;
}): JSX.Element {
  return <View testID={`${testID}-row`} className="w-full flex-row items-center gap-3">
    <Switch testID={testID} accessibilityLabel={accessibilityLabel} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    <Pressable testID={`${testID}-label`} className="grow" disabled={disabled} onPress={() => onCheckedChange(!checked)}>
      <Text className="grow text-sm text-foreground">{label}</Text>
    </Pressable>
  </View>;
}

/** v2's SegmentedControl: one row of radio segments. */
function Segmented({ testID, label, value, segments, onChange }: {
  testID: string; label: string; value: string; segments: { value: string; label: string; disabled?: boolean }[]; onChange(value: string): void;
}): JSX.Element {
  return <View role="radiogroup" aria-label={label} testID={testID} className="min-h-11 flex-row overflow-hidden rounded-lg border border-border bg-card">
    {segments.map((segment, index) => {
      const selected = segment.value === value;
      return <Pressable key={segment.value} role="radio" aria-checked={selected} disabled={segment.disabled} testID={`${testID}-segment-${segment.value}`}
        className={'flex-1 flex-row items-center justify-center px-3 py-1.5 web:hover:bg-accent active:opacity-70'
          + (index > 0 ? ' border-l border-border' : '') + (selected ? ' bg-primary/10' : '') + (segment.disabled ? ' opacity-45' : '')}
        onPress={() => { if (!selected && !segment.disabled) onChange(segment.value); }}>
        <Text className={'text-base font-medium ' + (selected ? 'text-primary' : 'text-muted-foreground')}>{segment.label}</Text>
      </Pressable>;
    })}
  </View>;
}

export function CatalogueDisplayOptions({ state, onChange, products, quickFilterCount }: {
  state: AppCatalogueViewState; onChange(next: AppCatalogueViewState): void; products: any[]; quickFilterCount: number;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const tileSize = typeof state.gridColumns === 'number' ? state.gridColumns : 4;
  const categoryCount = termOptions(products, 'categories', 'category').length;
  const tagCount = termOptions(products, 'tags', 'tag').length;
  const browseRows: { value: string; label: string; help?: string }[] = [
    { value: 'all', label: 'All products' },
    { value: 'categories', label: 'Categories', help: categoryCount === 0 ? 'No categories yet' : countLabel(categoryCount, 'category', 'categories') },
    { value: 'tags', label: 'Tags', help: tagCount === 0 ? 'No tags yet' : countLabel(tagCount, 'tag', 'tags') },
    { value: 'brands', label: 'Brands' },
    { value: 'shortcuts', label: 'Shortcuts', help: quickFilterCount === 0 ? 'No shortcuts yet' : countLabel(quickFilterCount, 'quick filter', 'quick filters') },
  ];
  const sortField = QUICK_FILTER_SORT_FIELDS.find(field => field === state.sort?.field);
  return <>
    <Button testID="catalogue-settings-button" variant="outline" onPress={() => setOpen(true)}><Text>Product settings</Text></Button>
    {open && <Dialog open onOpenChange={next => { if (!next) setOpen(false); }}>
      <DialogContent testID="catalogue-settings" className={settingsSheetClassName(state.position)}>
        <View className="flex-row items-center justify-between px-4">
          <DialogTitle>Product settings</DialogTitle>
          <IconButton variant="ghost" size="sm" testID="catalogue-settings-x" accessibilityLabel="Close" onPress={() => setOpen(false)}><XIcon size={16} /></IconButton>
        </View>
        <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 py-1">
          <View className="gap-1">
            <FieldLabel>View Mode</FieldLabel>
            <Segmented testID="view-mode" label="View Mode" value={state.view} segments={[{ value: 'grid', label: 'Grid' }, { value: 'table', label: 'Table' }]}
              onChange={value => onChange({ ...state, view: value as AppCatalogueViewState['view'] })} />
          </View>
          {state.view === 'grid' && <View className="gap-1">
            <View className="flex-row items-center justify-between">
              <FieldLabel>Tile Size</FieldLabel>
              <Text testID="tile-size-value" className="text-muted-foreground">{String(tileSize)}</Text>
            </View>
            <Slider testID="tile-size" aria-label="Tile Size" min={2} max={8} step={1} value={tileSize}
              onValueChange={n => onChange({ ...state, gridColumns: n as AppCatalogueViewState['gridColumns'] })} />
          </View>}
          <View className="gap-1">
            <FieldLabel>Browse by</FieldLabel>
            {/* v2's BrowseByField. All products and Categories work (the browse stage in catalogue-view.tsx);
                Tags, Brands and Shortcuts wait for their own slices. */}
            <View role="radiogroup" aria-label="Browse by" className="overflow-hidden rounded-lg border border-border">
              {browseRows.map((row, index) => {
                const live = BROWSE_BY.find(value => value === row.value);
                const disabled = live === undefined;
                const checked = row.value === state.browseBy;
                return <Pressable key={row.value} role="radio" aria-checked={checked} aria-disabled={disabled} disabled={disabled} testID={`ui-settings-browse-by-${row.value}`}
                  onPress={() => { if (live !== undefined && !checked) onChange({ ...state, browseBy: live }); }}
                  className={'min-h-11 flex-row items-center gap-2 px-3 py-2' + (index < browseRows.length - 1 ? ' border-b border-border' : '') + (disabled ? ' opacity-45' : ' web:hover:bg-accent active:opacity-70')}>
                  <CheckIcon size={16} className={checked ? 'text-primary' : 'opacity-0'} />
                  <Text className="flex-1">{row.label}</Text>
                  {row.help !== undefined && <Text className="text-sm text-muted-foreground">{row.help}</Text>}
                </Pressable>;
              })}
            </View>
          </View>
          <SwitchRow label="Show out-of-stock products" testID="show-out-of-stock" accessibilityLabel="Show out-of-stock products"
            checked={state.showOutOfStock} onCheckedChange={next => onChange({ ...state, showOutOfStock: next })} />
          <View className="flex-row items-end gap-2">
            <View className="flex-1 gap-1">
              <FieldLabel>Sort By</FieldLabel>
              <Select value={sortField === undefined ? undefined : { value: sortField, label: SORT_LABELS[sortField] }}
                onValueChange={option => { if (option) onChange({ ...state, sort: { field: option.value, dir: state.sort?.dir ?? 'asc' } }); }}>
                <SelectTrigger testID="sort-by"><SelectValue placeholder="Sort By" /></SelectTrigger>
                <SelectContent><SelectGroup>
                  {QUICK_FILTER_SORT_FIELDS.map(field => <SelectItem key={field} value={field} label={SORT_LABELS[field]}
                    testID={`sort-by-option-${field}`}><Text>{SORT_LABELS[field]}</Text></SelectItem>)}
                </SelectGroup></SelectContent>
              </Select>
            </View>
            <View className="gap-1">
              <FieldLabel>Sort Direction</FieldLabel>
              <Segmented testID="sort-direction" label="Sort Direction" value={state.sort?.dir ?? ''}
                segments={[{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }]}
                onChange={value => onChange({ ...state, sort: { field: state.sort?.field ?? 'name', dir: value as ProductSort['dir'] } })} />
            </View>
          </View>
          <View className="gap-1">
            <FieldLabel>Variations</FieldLabel>
            {/* v2's variationsStyle. The app only opens variations in place (VariantChooser); inline is a Follow-up. */}
            <Segmented testID="products-variations-style" label="Variations" value="drill" onChange={() => {}}
              segments={[{ value: 'drill', label: 'Open in place' }, { value: 'inline', label: state.view === 'grid' ? 'Popover' : 'Expanded rows', disabled: true }]} />
          </View>
          {state.view === 'grid' ? <View className="gap-2 px-1 pt-2">
            <Text className="text-sm font-semibold">Tile Fields</Text>
            {CATALOGUE_TILE_FIELDS.map(({ id, label }) => <SwitchRow key={id} label={label}
              testID={`tile-field-toggle-${id}`} accessibilityLabel={`Show ${label} on tiles`}
              checked={state.tileFields[id]}
              onCheckedChange={next => onChange({ ...state, tileFields: { ...state.tileFields, [id]: next } })} />)}
          </View> : <View className="gap-2 px-1 pt-2">
            <Text className="text-sm font-semibold">Columns</Text>
            {state.columns.map(({ id, visible }) => {
              const label = CATALOGUE_COLUMNS.find(column => column.id === id)!.label;
              return <SwitchRow key={id} label={label}
                testID={`column-toggle-${id}`} accessibilityLabel={`Show ${label}`}
                checked={visible} disabled={id === 'name'}
                onCheckedChange={next => onChange({ ...state, columns: state.columns.map(c => c.id === id ? { ...c, visible: next } : c) })} />;
            })}
          </View>}
        </ScrollView>
        <View className="flex-row justify-between border-t border-border px-4 pt-4">
          {/* The panel position belongs to Cart Settings (v2 pos-cart.position), so restoring the products keeps it. */}
          <Button testID="catalogue-settings-restore" variant="outline" className="border-destructive" onPress={() => onChange({ ...CATALOGUE_VIEW_DEFAULTS, position: state.position })}>
            <Text className="text-destructive">Restore Default Settings</Text>
          </Button>
          <Button testID="catalogue-settings-close" variant="outline" onPress={() => setOpen(false)}><Text>Close</Text></Button>
        </View>
      </DialogContent>
    </Dialog>}
  </>;
}
