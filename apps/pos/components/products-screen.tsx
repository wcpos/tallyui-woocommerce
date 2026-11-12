// v2's Products area (WCPOS monorepo `packages/core/src/screens/main/products/products.tsx`), read-only: the default
// shown columns of ui-settings `initial-settings.json` "products" without Actions, name asc, and the cell rules of
// cells/name.tsx, stock-quantity.tsx, stock-status.tsx and price.tsx, with v2's English strings from core.json.
// Its filter chips are the catalogue's (v2 passes `chips={<FilterBar />}`), starting with none on, as v2 does. The
// bar's display options switch v2's columns (area-display-options.tsx).
// A variable product drills into its variations as v2's default 'drill' style does (products.tsx `drillTo`,
// `DrillPane`, pos/products/drill-in.tsx): the crumb "Products › <name>" over the variations, on their own card
// (`products-variations-surface`) under the table's labels, with the Stock Status chip applied to them; a search
// change drops the drill for good. The variations are the product doc's own `variation_docs`, as the catalogue's.
// Deviations: no inline editing, Manage toggle, Actions column or column reordering, since
// edits must go through the store's REST API; the products collection is replicated from the server, so this
// screen takes plain docs and never touches it. The Featured and Brands chips are still missing: they need
// connector data the app does not sync. The drilled view has no per-attribute variation selects or variation
// search: an option's match shows as one chip that clears it.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { ConnectorProvider, formatMoney, moneyFromDecimalString } from '@tallyui/core';
import type { TallyConnector } from '@tallyui/core';
import { Button, ProductImage, ProductTable, SearchInput, Text } from '@tallyui/components';
import type { ProductTableColumn } from '@tallyui/components';
import { searchProducts, sortProducts } from '@tallyui/pos';
import type { ProductSort } from '@tallyui/pos';
import { resolveStock, STOCK_LABEL } from '../lib/products/resolve-stock';
import type { StockState } from '../lib/products/resolve-stock';
import { matchesCatalogueFilters } from '../lib/catalogue/quick-filters';
import type { CatalogueFilters } from '../lib/catalogue/quick-filters';
import { useAreaColumns } from '../lib/area-columns';
import type { AreaColumn } from '../lib/area-columns';
import { AreaDisplayOptions } from './area-display-options';
import { AreaToolbar, useAreaGutter } from './area-header';
import { BrowseCrumb } from './browse-terms-view';
import { CatalogueFilterChips } from './catalogue-filter-chips';
import { ProductAttributes, variationMatches, variationName } from './product-attributes';
import type { ProductAttribute, VariationDoc, VariationMatch } from './product-attributes';
import { gmtDayText } from './coupons-screen';
import { StatusDot } from './status-dot';
import { CaptionRowInset, TableCount, TableSurface, useCatalogueSync } from './table-surface';
import type { StatusTone } from './status-dot';

// v2's QuerySearchInput debounce (packages/core/src/screens/main/components/query-search-input.tsx:33).
const SEARCH_DEBOUNCE_MS = 250;
// The width below which the table becomes a list, as customers-screen.tsx.
const NARROW_WIDTH = 600;
// The image cell's square, about v2's thumbnail.
const IMAGE_SIZE = 40;
// v2's default sort for the products table (initial-settings.json "products").
const NAME_ASC: ProductSort = { field: 'name', dir: 'asc' };

// v2's stockTones (cells/stock-status.tsx): instock ok, outofstock bad, onbackorder warning.
const STOCK_TONE: Record<StockState, StatusTone> = {
  instock: 'success', outofstock: 'destructive', onbackorder: 'warning',
};

export type ProductsColumnId = 'image' | 'id' | 'name' | 'type' | 'sku' | 'barcode' | 'stock_quantity' | 'stock_status'
  | 'categories' | 'tags' | 'price' | 'regular_price' | 'sale_price' | 'date_modified_gmt';
// v2's products columns (ui-settings/initial-settings.json `products.columns`) that the synced product doc carries, in
// its order, with v2's keys, its `show` and its labels (use-ui-label.ts). Not offered: brands, cost_of_goods_sold and
// date_created_gmt, which the product schema does not sync, and Actions.
export const PRODUCTS_COLUMNS: readonly AreaColumn<ProductsColumnId>[] = [
  { id: 'image', label: 'Image', visible: true },
  { id: 'id', label: 'ID', visible: false },
  { id: 'name', label: 'Product', visible: true },
  { id: 'type', label: 'Type', visible: false },
  { id: 'sku', label: 'SKU', visible: false },
  { id: 'barcode', label: 'Barcode', visible: false },
  { id: 'stock_quantity', label: 'Stock', visible: true },
  { id: 'stock_status', label: 'Stock Status', visible: true },
  { id: 'categories', label: 'Categories', visible: true },
  { id: 'tags', label: 'Tags', visible: false },
  { id: 'price', label: 'Price', visible: true },
  { id: 'regular_price', label: 'Regular Price', visible: true },
  { id: 'sale_price', label: 'Sale Price', visible: true },
  { id: 'date_modified_gmt', label: 'Date Modified', visible: false },
];
const LABEL = Object.fromEntries(PRODUCTS_COLUMNS.map(({ id, label }) => [id, label])) as Record<ProductsColumnId, string>;

interface ProductDoc {
  id: number;
  name: string;
  type?: string;
  sku?: string;
  barcode?: string;
  tags?: { name?: string }[];
  date_modified_gmt?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  manage_stock?: boolean;
  stock_quantity?: number | null;
  stock_status?: string;
  categories?: { name?: string }[];
  variations?: number[];
  attributes?: ProductAttribute[];
  variation_docs?: VariationDoc[];
}

/** v2's Drill: the product, the search it was opened under, and an option's match. */
interface Drill { id: number; query: string; match?: VariationMatch }
type OnDrill = (doc: ProductDoc, match?: VariationMatch) => void;

export interface ProductsScreenProps {
  /** Plain product docs, kept live by the catalogue; read only. */
  products: any[];
  connector: TallyConnector;
  currency: string;
  /** The store's locale, WordPress style (`en_US`) or BCP 47. */
  locale?: string;
  onBack(): void;
}

/** v2 cells/stock-quantity.tsx shows the quantity only for self-managed stock. */
function stockQuantity(doc: ProductDoc): number | undefined {
  return doc.manage_stock === true && typeof doc.stock_quantity === 'number' ? doc.stock_quantity : undefined;
}

/** A decimal string as a sortable number; empty or unparseable sorts last. */
function priceValue(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function money(value: string | undefined, currency: string, locale: string | undefined): string {
  if (!value) return '';
  const parsed = moneyFromDecimalString(value, currency);
  return (parsed && formatMoney(parsed, locale)) ?? value;
}

function StockBadge({ doc }: { doc: ProductDoc | VariationDoc }): JSX.Element {
  const state = resolveStock(doc);
  return <StatusDot testID={`product-stock-status-${doc.id}`} tone={STOCK_TONE[state]} label={STOCK_LABEL[state]} />;
}

/** v2's ProductName (cells/name.tsx): the name, then ProductAttributes for a variable product. */
function NameCell({ doc, onDrill, numberOfLines }: { doc: ProductDoc; onDrill: OnDrill; numberOfLines?: number }): JSX.Element {
  return (
    <View className="gap-1">
      <Text numberOfLines={numberOfLines} className="font-medium text-foreground">{doc.name}</Text>
      {doc.type === 'variable' ? (
        <ProductAttributes id={doc.id} attributes={doc.attributes} count={doc.variations?.length ?? 0}
          onDrill={match => onDrill(doc, match)} />
      ) : null}
    </View>
  );
}

/** v2's ProductVariationName (cells/variation-name.tsx): the variation's options, in bold. */
function VariationNameCell({ variation, parent }: { variation: VariationDoc; parent: ProductDoc }): JSX.Element {
  return <Text testID={`product-variation-name-${variation.id}`} className="font-bold text-foreground">
    {variationName(variation, parent.name)}
  </Text>;
}

/** v2's DrillPane rows: the drilled product's published variations that pass the Stock Status chip and the match. */
function drilledVariations(parent: ProductDoc, filters: CatalogueFilters, match: VariationMatch | undefined): VariationDoc[] {
  return (parent.variation_docs ?? []).filter(variation => (variation.status === undefined || variation.status === 'publish')
    && (filters.stock_status === undefined || resolveStock(variation) === filters.stock_status)
    && variationMatches(variation, match));
}

function termNames(terms: { name?: string }[] | undefined): string {
  return (terms ?? []).map(term => term.name).filter(Boolean).join(', ') || '—';
}

/** Every column of PRODUCTS_COLUMNS, in its order; the screen hands ProductTable the ones left on. */
function productColumns(currency: string, locale: string | undefined, onDrill: OnDrill): (ProductTableColumn<ProductDoc> & { id: ProductsColumnId })[] {
  const priceColumn = (id: 'price' | 'regular_price' | 'sale_price') => ({
    id, header: LABEL[id], flex: 1,
    render: (doc: ProductDoc) => <Text testID={`product-${id}-${doc.id}`}>{money(doc[id], currency, locale)}</Text>,
    sortValue: (doc: ProductDoc) => priceValue(doc[id]),
  });
  // v2's plain cells (no cell renderer: the field's text); sortable where v2's column has no `disableSort`.
  const textColumn = (id: 'type' | 'sku' | 'barcode', flex: number) => ({
    id, header: LABEL[id], flex,
    render: (doc: ProductDoc) => <Text testID={`product-${id}-${doc.id}`}>{doc[id] ?? ''}</Text>,
    sortValue: (doc: ProductDoc) => doc[id],
  });
  return [
    { id: 'image', header: LABEL.image, flex: 0.6, render: doc => <ProductImage doc={doc} size={IMAGE_SIZE} /> },
    { id: 'id', header: LABEL.id, flex: 0.6, render: doc => <Text testID={`product-id-${doc.id}`}>{String(doc.id)}</Text>, sortValue: doc => doc.id },
    { id: 'name', header: LABEL.name, flex: 3, render: doc => <NameCell doc={doc} onDrill={onDrill} />, sortValue: doc => doc.name },
    textColumn('type', 1),
    textColumn('sku', 1),
    textColumn('barcode', 1.2),
    { id: 'stock_quantity', header: LABEL.stock_quantity, flex: 1,
      render: doc => <Text testID={`product-stock-quantity-${doc.id}`}>{String(stockQuantity(doc) ?? '—')}</Text>,
      sortValue: doc => stockQuantity(doc) },
    { id: 'stock_status', header: LABEL.stock_status, flex: 1.4, render: doc => <StockBadge doc={doc} /> },
    { id: 'categories', header: LABEL.categories, flex: 2, render: doc => <Text>{termNames(doc.categories)}</Text> },
    { id: 'tags', header: LABEL.tags, flex: 2, render: doc => <Text testID={`product-tags-${doc.id}`}>{termNames(doc.tags)}</Text> },
    priceColumn('price'),
    priceColumn('regular_price'),
    priceColumn('sale_price'),
    // v2's RecordDateCell; the day reads as the coupons area's dates do.
    { id: 'date_modified_gmt', header: LABEL.date_modified_gmt, flex: 1.2,
      render: doc => <Text testID={`product-date_modified_gmt-${doc.id}`}>{gmtDayText(doc.date_modified_gmt, locale)}</Text> },
  ];
}

/** v2's variationCells over the products table's shown columns, under plain labels (DrillPane's PaneHeadRow): the
 *  variation's own fields where it has them, the parent's image, ProductVariationName, and empty terms. */
function variationColumns(columns: (ProductTableColumn<ProductDoc> & { id: ProductsColumnId })[], parent: ProductDoc)
  : ProductTableColumn<VariationDoc>[] {
  return columns.map(({ id, header, flex, render }) => ({
    id, header, flex,
    render: (variation: VariationDoc) => id === 'image' ? <ProductImage doc={parent} size={IMAGE_SIZE} />
      : id === 'name' ? <VariationNameCell variation={variation} parent={parent} />
        : id === 'categories' || id === 'tags' ? null
          : render({ ...variation, name: variationName(variation, parent.name) }),
  }));
}

export function ProductsScreen({ products, connector, currency, locale: storeLocale, onBack }: ProductsScreenProps): JSX.Element {
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  // v2's page gutter (ground.ts:46-72): the crumb and chip rows sit on the bar's 12 in a window, 16 on a phone.
  const gutter = useAreaGutter();
  // v2's Products area lists every product, in stock or not: no chip is on at the start.
  const [filters, setFilters] = useState<CatalogueFilters>({});
  const [settings, setSettings] = useAreaColumns('products', PRODUCTS_COLUMNS);
  const [drill, setDrill] = useState<Drill | null>(null);
  const { width } = useWindowDimensions();
  const sync = useCatalogueSync();
  const locale = storeLocale?.replaceAll('_', '-');

  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  // v2's drill holds while the search it was opened under does (products.tsx `drilled`); otherwise it is dropped,
  // not parked, so restoring the search does not bring it back. Reset while rendering, React's "previous render"
  // pattern, as v2 does. A product gone from the docs drops it too.
  const drilled = drill && drill.query === query ? (products as ProductDoc[]).find(doc => doc.id === drill.id) : undefined;
  if (drill && !drilled) setDrill(null);
  const drillTo = useCallback<OnDrill>((doc, match) => setDrill({ id: doc.id, query, match }), [query]);

  function clear() { setTerm(''); setQuery(''); setFilters({}); }

  const columns = useMemo(() => productColumns(currency, locale, drillTo), [currency, locale, drillTo]);
  // The columns the display options leave on, in the area's order; the narrow list keeps sorting on every column.
  const tableColumns = useMemo(() => columns.filter(column => settings.some(setting => setting.id === column.id && setting.visible)),
    [columns, settings]);
  const searched = useMemo(() => query ? searchProducts(products, query, connector.traits.product) : products,
    [products, query, connector.traits.product]);
  const shown = useMemo(() => searched.filter(doc => matchesCatalogueFilters(doc, filters)), [searched, filters]);
  const total = products.length;
  const narrow = width < NARROW_WIDTH;
  const listed = useMemo(() => narrow ? sortProducts([...shown], NAME_ASC,
    (doc, field) => columns.find(column => column.id === field)?.sortValue?.(doc)) as ProductDoc[] : [], [narrow, shown, columns]);
  const variations = useMemo(() => drilled ? drilledVariations(drilled, filters, drill?.match) : [], [drilled, filters, drill?.match]);
  const paneColumns = useMemo(() => drilled ? variationColumns(tableColumns, drilled) : [], [drilled, tableColumns]);

  const noVariations = (
    <View testID="no-data-message" className="flex-1 items-center justify-center gap-2 p-6">
      <Text testID="no-data-message-title" className="text-center font-medium text-foreground">No variations found</Text>
    </View>
  );
  // v2's DrillIn: the crumb, then the pane on its own card, the variations under the table's labels.
  const pane = drilled ? (
    <>
      <View testID="products-crumb-row" className={`flex-row flex-wrap items-center gap-2 pb-2 ${gutter}`}>
        <BrowseCrumb place={null} onRoot={() => setDrill(null)} product={{ name: drilled.name, onBack: () => setDrill(null) }} />
        {drill?.match ? (
          <Button testID="products-variation-match" accessibilityLabel={`Clear ${drill.match.name}: ${drill.match.option}`}
            variant="outline" size="sm" onPress={() => setDrill({ ...drill, match: undefined })}>
            <Text>{`${drill.match.name}: ${drill.match.option} ×`}</Text>
          </Button>
        ) : null}
      </View>
      <TableSurface testID="products-variations-surface">
        {variations.length === 0 ? noVariations : narrow ? (
          <ScrollView testID="products-variations-body">
            {variations.map(variation => (
              <View key={variation.id} testID={`products-row-${variation.id}`} className="flex-row items-center gap-3 border-b border-border px-4 py-3">
                <ProductImage doc={drilled} size={IMAGE_SIZE} />
                <View className="flex-1 gap-1">
                  <VariationNameCell variation={variation} parent={drilled} />
                  <Text numberOfLines={1} className="text-muted-foreground">{money(variation.price, currency, locale)}</Text>
                </View>
                <StockBadge doc={variation} />
              </View>
            ))}
          </ScrollView>
        ) : (
          // In the doc's order, as v2's pane lists them (menu_order); its head row has no sort.
          <ProductTable testID="products-variations-body" items={variations} columns={paneColumns} sortItems={false} showUnsellable />
        )}
      </TableSurface>
    </>
  ) : null;

  const body = total === 0 ? (
    <View testID="no-data-message" className="flex-1 items-center justify-center gap-2 p-6">
      <Text testID="no-data-message-title" className="text-center font-medium text-foreground">No products yet</Text>
      <Text testID="no-data-message-description" className="text-center text-muted-foreground">Products you add to the store will appear here.</Text>
    </View>
  ) : shown.length === 0 ? (
    <View testID="no-data-message" className="flex-1 items-center justify-center gap-2 p-6">
      <Text testID="no-data-message-title" className="text-center font-medium text-foreground">No products found</Text>
      <Button testID="no-data-message-action" variant="ghost" size="sm" onPress={clear}><Text>Clear filters</Text></Button>
    </View>
  ) : narrow ? (
        <ScrollView testID="products-body">
          {listed.map(doc => (
            <View key={doc.id} testID={`products-row-${doc.id}`} className="flex-row items-center gap-3 border-b border-border px-4 py-3">
              <ProductImage doc={doc} size={IMAGE_SIZE} />
              <View className="flex-1 gap-1">
                <NameCell doc={doc} onDrill={drillTo} numberOfLines={1} />
                <Text numberOfLines={1} className="text-muted-foreground">{money(doc.price, currency, locale)}</Text>
              </View>
              <StockBadge doc={doc} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <ProductTable testID="products-body" items={shown} columns={tableColumns} defaultSort={NAME_ASC} showUnsellable />
      );

  return (
    <ConnectorProvider connector={connector} traitContext={{ currency }}>
      <View testID="screen-products" className="flex-1 bg-background">
        <AreaToolbar area="products" title="Products" onBack={onBack}
          search={<SearchInput testID="search-products" value={term} onChangeText={setTerm} placeholder="Search products" />}>
          <AreaDisplayOptions area="products" columns={PRODUCTS_COLUMNS} settings={settings} onChange={setSettings} />
        </AreaToolbar>
        <View testID="products-filter-row" className={`pb-2 ${gutter}`}>
          <CatalogueFilterChips products={products} filters={filters} onChange={setFilters} />
        </View>
        {drilled ? pane : <TableSurface testID="products-table-surface">{body}</TableSurface>}
        {drilled ? (
          // v2's VariationTableFooter: the parent's own variation list is the total, never fewer than are drawn.
          variations.length > 0 && <CaptionRowInset>
            <TableCount shown={variations.length} total={Math.max(drilled.variations?.length ?? 0, variations.length)}
              active={sync.active} onSync={sync.sync} />
          </CaptionRowInset>
        ) : shown.length > 0 && (
          <CaptionRowInset><TableCount shown={shown.length} total={total} active={sync.active} onSync={sync.sync} /></CaptionRowInset>
        )}
      </View>
    </ConnectorProvider>
  );
}
