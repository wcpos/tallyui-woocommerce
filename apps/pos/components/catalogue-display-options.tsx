// v2's Product settings side sheet (WCPOS monorepo `packages/core/src/screens/main/pos/products/ui-settings-form.tsx`).
import type { JSX } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Path } from 'react-native-svg';
import { Button, createSvgIcon, Dialog, DialogContent, DialogTitle, IconButton, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, Slider, Text, Tooltip, TooltipContent, TooltipTrigger, XIcon } from '@tallyui/components';
import type { ProductSort } from '@tallyui/pos';
import { BROWSE_BY, CATALOGUE_COLUMNS, CATALOGUE_TILE_FIELDS, CATALOGUE_VIEW_DEFAULTS } from '../lib/catalogue/catalogue-view-state';
import type { AppCatalogueViewState, PanelPosition } from '../lib/catalogue/catalogue-view-state';
import { QUICK_FILTER_SORT_FIELDS } from '../lib/catalogue/quick-filters';
import { termOptions } from './catalogue-filter-chips';
import { Segmented } from './segmented';
import { ChevronDownIcon, FieldLabel, SELECT_FACE, SwitchRow } from './select-chevron';

const CheckIcon = createSvgIcon('CheckIcon', () => <Path d="M20 6 9 17l-5-5" />);
// lucide `sliders-horizontal`, v2's `filters` icon: the Product settings trigger and the areas' display options (area-display-options.tsx).
export const SlidersIcon = createSvgIcon('SlidersIcon', () => <>
  <Path d="M21 4h-7" /><Path d="M10 4H3" /><Path d="M21 12h-9" /><Path d="M8 12H3" /><Path d="M21 20h-5" /><Path d="M12 20H3" />
  <Path d="M14 2v4" /><Path d="M8 10v4" /><Path d="M16 18v4" />
</>);

export const RIGHT_SHEET = 'left-auto right-0 top-0 h-full w-full max-w-lg translate-x-0 translate-y-0 gap-4 rounded-none border-0 border-l border-border bg-card p-0 py-4';
const LEFT_SHEET = 'left-0 right-auto top-0 h-full w-full max-w-lg translate-x-0 translate-y-0 gap-4 rounded-none border-0 border-r border-border bg-card p-0 py-4';

export function settingsSheetClassName(position: PanelPosition): string {
  // v2's usePanelSide('products'): the sheet slides in over the cart.
  return position === 'left' ? RIGHT_SHEET : LEFT_SHEET;
}

const SORT_LABELS: Record<(typeof QUICK_FILTER_SORT_FIELDS)[number], string> = { name: 'Name', sku: 'SKU', barcode: 'Barcode', price: 'Price', stock: 'Stock Quantity' };

function countLabel(count: number, one: string, many: string): string { return `${count} ${count === 1 ? one : many}`; }

/** v2's Product settings trigger in the search row: a sliders icon with the tooltip "Product settings". */
export function CatalogueSettingsButton({ onPress }: { onPress(): void }): JSX.Element {
  return <Tooltip>
    <TooltipTrigger asChild>
      <IconButton testID="catalogue-settings-button" variant="ghost" accessibilityLabel="Product settings" onPress={onPress}>
        <SlidersIcon size={20} className="text-foreground" />
      </IconButton>
    </TooltipTrigger>
    <TooltipContent><Text>Product settings</Text></TooltipContent>
  </Tooltip>;
}

/** The sheet itself. Its open state lives with the catalogue, since the search row that holds the trigger remounts with the view. */
export function CatalogueDisplayOptions({ state, onChange, products, quickFilterCount, open, onOpenChange: setOpen, onCustomiseFilterBar }: {
  state: AppCatalogueViewState; onChange(next: AppCatalogueViewState): void; products: any[]; quickFilterCount: number;
  open: boolean; onOpenChange(open: boolean): void;
  /** Opens the filter bar dialog; the sheet closes first, as v2's "Customise filter bar" does. */
  onCustomiseFilterBar(): void;
}): JSX.Element {
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
    {open && <Dialog open onOpenChange={next => { if (!next) setOpen(false); }}>
      <DialogContent testID="catalogue-settings" className={settingsSheetClassName(state.position)}>
        {/* v2's DialogHeader (dialog/index.tsx: pl-4 pr-ctl) holds only the title, its dialog rank 16 px leading-none;
            the close is an absolute h-ctl square at top-1 right-1, so the header row is the title's height. */}
        <View testID="catalogue-settings-header" className="pl-4 pr-11">
          <DialogTitle className="text-base">Product settings</DialogTitle>
        </View>
        <View className="absolute right-1 top-1">
          <IconButton variant="ghost" className="h-11 w-11" testID="catalogue-settings-x" accessibilityLabel="Close" onPress={() => setOpen(false)}><XIcon size={18} /></IconButton>
        </View>
        {/* v2's DialogBody: VStack's gap-2 between fields (components vstack/index.tsx), FormItem's gap-1.5 inside one (form/common.tsx). */}
        <ScrollView testID="catalogue-settings-list" className="flex-1" contentContainerClassName="gap-2 px-4 py-1">
          <View className="gap-1.5">
            <FieldLabel>View Mode</FieldLabel>
            <Segmented testID="view-mode" label="View Mode" value={state.view} segments={[{ value: 'grid', label: 'Grid' }, { value: 'table', label: 'Table' }]}
              onChange={value => onChange({ ...state, view: value as AppCatalogueViewState['view'] })} />
          </View>
          {state.view === 'grid' && <View testID="tile-size-field" className="gap-1.5">
            <View className="flex-row items-center justify-between">
              <FieldLabel>Tile Size</FieldLabel>
              <Text testID="tile-size-value" className="leading-none text-muted-foreground">{String(tileSize)}</Text>
            </View>
            {/* v2's Slider (slider/index.tsx) is a flex-row whose h-2 track sets its height and whose thumb overhangs.
                TallyUI's root is h-5 in a column, so its track grows to 20 px: a row keeps the track h-2, and
                -my-1.5 gives the 20 px root v2's 8 px of layout. */}
            <Slider testID="tile-size" aria-label="Tile Size" className="-my-1.5 flex-row" min={2} max={8} step={1} value={tileSize}
              onValueChange={n => onChange({ ...state, gridColumns: n as AppCatalogueViewState['gridColumns'] })} />
          </View>}
          <View className="gap-1.5">
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
          <View className="flex-row items-end gap-2 px-1">
            <View className="flex-1 gap-1.5">
              <FieldLabel>Sort By</FieldLabel>
              <Select value={sortField === undefined ? undefined : { value: sortField, label: SORT_LABELS[sortField] }}
                onValueChange={option => { if (option) onChange({ ...state, sort: { field: option.value, dir: state.sort?.dir ?? 'asc' } }); }}>
                <SelectTrigger testID="sort-by" className={SELECT_FACE}>
                  <SelectValue placeholder="Sort By" />
                  <ChevronDownIcon testID="sort-by-chevron" size={16} className="text-muted-foreground" />
                </SelectTrigger>
                <SelectContent><SelectGroup>
                  {QUICK_FILTER_SORT_FIELDS.map(field => <SelectItem key={field} value={field} label={SORT_LABELS[field]}
                    testID={`sort-by-option-${field}`}><Text>{SORT_LABELS[field]}</Text></SelectItem>)}
                </SelectGroup></SelectContent>
              </Select>
            </View>
            <View className="gap-1.5">
              <FieldLabel>Sort Direction</FieldLabel>
              <Segmented testID="sort-direction" label="Sort Direction" value={state.sort?.dir ?? ''}
                segments={[{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }]}
                onChange={value => onChange({ ...state, sort: { field: state.sort?.field ?? 'name', dir: value as ProductSort['dir'] } })} />
            </View>
          </View>
          <View className="gap-1.5">
            <FieldLabel>Variations</FieldLabel>
            {/* v2's variationsStyle. The app only opens variations in place (VariantChooser); inline is a Follow-up. */}
            <Segmented testID="products-variations-style" label="Variations" value="drill" onChange={() => {}}
              segments={[{ value: 'drill', label: 'Open in place' }, { value: 'inline', label: state.view === 'grid' ? 'Popover' : 'Expanded rows', disabled: true }]} />
          </View>
          {/* v2: a `gap-2 px-1 pt-2` View, its SectionHeading, then one FormSwitch per field. */}
          {state.view === 'grid' ? <View testID="tile-fields" className="gap-2 px-1 pt-2">
            <Text role="heading" aria-level={2} className="text-sm font-semibold">Tile Fields</Text>
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
          <View testID="catalogue-settings-filter-bar" className="gap-2 px-1 pt-2">
            <View className="gap-0.5">
              <Text role="heading" aria-level={2} className="text-sm font-semibold">Filter bar</Text>
              <Text className="text-sm text-muted-foreground">Choose which filters appear on the bar and add quick filters that apply several conditions at once.</Text>
            </View>
            <Button variant="outline" testID="customize-filter-bar" onPress={() => { setOpen(false); onCustomiseFilterBar(); }}>
              <Text>Customise filter bar</Text>
            </Button>
          </View>
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
