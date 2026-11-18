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
import { useCallback, useMemo, useState } from 'react';
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
import { useAreaColumns, visibleAreaColumns } from '../lib/area-columns';
import type { AreaColumn } from '../lib/area-columns';
import { NARROW_WIDTH } from '../lib/layout/wide';
import { useSearchTerm } from '../lib/search-term';
import { lookupCode } from '../lib/scan/lookup';
import { useWedgeScanner } from '../lib/scan/use-wedge-scanner';
import { toast } from '../lib/toast/toast';
import { AreaDisplayOptions } from './area-display-options';
import { AreaToolbar, useAreaGutter } from './area-header';
import { BrowseCrumb } from './browse-terms-view';
import { CatalogueFilterChips } from './catalogue-filter-chips';
import { EmptyState } from './empty-state';
import { LevelBack } from './level-back';
import { ProductAttributes, variationMatches, variationName } from './product-attributes';
import type { ProductAttribute, VariationDoc, VariationMatch } from './product-attributes';
import { gmtDayText } from './coupons-screen';
import { StatusDot } from './status-dot';
import { CaptionRowInset, TableCount, TableSurface, useCatalogueSync } from './table-surface';
import type { StatusTone } from './status-dot';

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
function stockQuantity(doc: ProductDoc | VariationDoc): number | undefined {
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

type PriceField = 'price' | 'regular_price' | 'sale_price';

/** v2's variable price range (get-variable-prices.ts, the server's Variable_Prices.php): the lowest and highest of a
 *  field over the published variations that carry it; none carrying it is no range, so the cell is empty. */
function variationRange(doc: ProductDoc, field: PriceField): { min: string; max: string } | undefined {
  let range: { min: string; max: string } | undefined;
  for (const variation of doc.variation_docs ?? []) {
    if (variation.status !== undefined && variation.status !== 'publish') continue;
    const value = variation[field];
    if (value === undefined || priceValue(value) === undefined) continue;
    // v2 counts a sale only while it is active (Variable_Price_Range.php:44-47,155-157): WooCommerce keeps
    // sale_price after a scheduled sale ends, so it must differ from regular_price and equal price.
    if (field === 'sale_price' && (Number(value) === Number(variation.regular_price) || Number(value) !== Number(variation.price))) continue;
    if (!range) range = { min: value, max: value };
    else {
      if (Number(value) < Number(range.min)) range.min = value;
      if (Number(value) > Number(range.max)) range.max = value;
    }
  }
  return range;
}

/** v2's VariableProductPrice (variable-price.tsx:39-71) for a variable product with variations: nothing without a
 *  range, one price when min equals max, else "min - max"; any other product shows its own field. */
function priceText(doc: ProductDoc, field: PriceField, currency: string, locale: string | undefined): string {
  if (doc.type !== 'variable' || (doc.variation_docs?.length ?? 0) === 0) return money(doc[field], currency, locale);
  const range = variationRange(doc, field);
  if (!range) return '';
  if (Number(range.min) === Number(range.max)) return money(range.max, currency, locale);
  return `${money(range.min, currency, locale)} - ${money(range.max, currency, locale)}`;
}

/** v2's ProductStockBadge (cells/stock-status.tsx:43-57): a managed quantity reads before the word. */
function StockBadge({ doc, quantity }: { doc: ProductDoc | VariationDoc; quantity?: number }): JSX.Element {
  const state = resolveStock(doc);
  return <StatusDot testID={`product-stock-status-${doc.id}`} tone={STOCK_TONE[state]} label={quantity === undefined ? STOCK_LABEL[state] : `${quantity} · ${STOCK_LABEL[state]}`} />;
}

/** v2's ProductName (cells/name.tsx): the name, then ProductAttributes for a variable product. */
function NameCell({ doc, onDrill, numberOfLines, showSku }: { doc: ProductDoc; onDrill: OnDrill; numberOfLines?: number; showSku?: boolean }): JSX.Element {
  return (
    <View className="gap-1">
      <Text numberOfLines={numberOfLines} className="font-medium text-foreground">{doc.name}</Text>
      {showSku && doc.sku ? <Text testID={`products-phone-sku-${doc.id}`} numberOfLines={1} className="text-muted-foreground">{doc.sku}</Text> : null}
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
  const priceColumn = (id: PriceField) => ({
    id, header: LABEL[id], flex: 1,
    render: (doc: ProductDoc) => <Text testID={`product-${id}-${doc.id}`}>{priceText(doc, id, currency, locale)}</Text>,
    sortValue: (doc: ProductDoc) => doc.type === 'variable' && (doc.variation_docs?.length ?? 0) > 0
      ? priceValue(variationRange(doc, id)?.min) : priceValue(doc[id]),
  });
  // v2's plain cells (no cell renderer: the field's text); sortable where v2's column has no `disableSort`.
  const textColumn = (id: 'type' | 'sku' | 'barcode', flex: number) => ({
    id, header: LABEL[id], flex,
    render: (doc: ProductDoc) => <Text testID={`product-${id}-${doc.id}`}>{doc[id] ?? ''}</Text>,
    sortValue: (doc: ProductDoc) => doc[id],
  });
  return [
    // v2's image column is unlabelled (initial-settings.json:252 `hideLabel`, data-table/index.tsx:493 header ''); the
    // display options keep its name. TallyUI's head has no accessible name to give it.
    { id: 'image', header: '', flex: 0.6, render: doc => <ProductImage doc={doc} size={IMAGE_SIZE} /> },
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

/** v2's body cell centres its content on the row (components/src/table/index.tsx:129 `flex-col justify-center`).
 *  ProductTableColumn takes no cell class, so each column's own content fills the cell and centres itself. */
function centred<Doc extends { id: number }>(columns: ProductTableColumn<Doc>[]): ProductTableColumn<Doc>[] {
  return columns.map(column => ({
    ...column,
    render: (doc: Doc) => <View testID={`product-cell-${column.id}-${doc.id}`} className="flex-1 justify-center">
      {column.render(doc)}
    </View>,
  }));
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
  const { term, query, type, set } = useSearchTerm();
  // v2's page gutter (ground.ts:46-72): the crumb and chip rows sit on the bar's 12 in a window, 16 on a phone.
  const gutter = useAreaGutter();
  // v2's Products area lists every product, in stock or not: no chip is on at the start.
  const [filters, setFilters] = useState<CatalogueFilters>({});
  const [settings, setSettings] = useAreaColumns('products', PRODUCTS_COLUMNS);
  const [drill, setDrill] = useState<Drill | null>(null);
  const { width } = useWindowDimensions();
  const sync = useCatalogueSync();
  const locale = storeLocale?.replaceAll('_', '-');

  // v2's drill holds while the search it was opened under does (products.tsx `drilled`); otherwise it is dropped,
  // not parked, so restoring the search does not bring it back. Reset while rendering, React's "previous render"
  // pattern, as v2 does. A product gone from the docs drops it too.
  const drilled = drill && drill.query === query ? (products as ProductDoc[]).find(doc => doc.id === drill.id) : undefined;
  if (drill && !drilled) setDrill(null);
  const drillTo = useCallback<OnDrill>((doc, match) => setDrill({ id: doc.id, query, match }), [query]);

  function clear() { set(''); setFilters({}); }

  // v2's useBarcode (products/use-barcode.ts:19-63, core.json common.barcode_scanned and product_found_locally_one /
  // _other): toast the local match count, info for 0 or 1 and warn for an ambiguous code, then search for it whatever
  // the count, which ends a drill as v2's does. While the display options panel is open a scan is dropped, but the
  // screen keeps the wedge, so the till under this route on the stack does not ring it up.
  const [optionsOpen, setOptionsOpen] = useState(false);
  function scan(code: string) {
    if (optionsOpen) return;
    const found = lookupCode(products, connector.traits.product, code, { currency });
    const count = found.kind === 'several' ? found.count : found.kind === 'none' ? 0 : 1;
    toast({ title: `Barcode scanned: ${code}`, description: `${count} ${count === 1 ? 'product' : 'products'} found locally`,
      type: count > 1 ? 'warning' : 'info' });
    set(code);
  }
  useWedgeScanner(scan, true);

  const columns = useMemo(() => productColumns(currency, locale, drillTo), [currency, locale, drillTo]);
  // The columns the display options leave on, in the area's order; the narrow list keeps sorting on every column.
  const tableColumns = useMemo(() => visibleAreaColumns(columns, settings), [columns, settings]);
  const searched = useMemo(() => query ? searchProducts(products, query, connector.traits.product) : products,
    [products, query, connector.traits.product]);
  const shown = useMemo(() => searched.filter(doc => matchesCatalogueFilters(doc, filters)), [searched, filters]);
  const total = products.length;
  const narrow = width < NARROW_WIDTH;
  const listed = useMemo(() => narrow ? sortProducts([...shown], NAME_ASC,
    (doc, field) => columns.find(column => column.id === field)?.sortValue?.(doc)) as ProductDoc[] : [], [narrow, shown, columns]);
  const variations = useMemo(() => drilled ? drilledVariations(drilled, filters, drill?.match) : [], [drilled, filters, drill?.match]);
  const bodyColumns = useMemo(() => centred(tableColumns), [tableColumns]);
  const paneColumns = useMemo(() => drilled ? centred(variationColumns(tableColumns, drilled)) : [], [drilled, tableColumns]);

  const noVariations = (
    <EmptyState kind="no-results" title="No variations found" />
  );
  // v2's DrillIn: the crumb, then the pane on its own card, the variations under the table's labels.
  const pane = drilled ? (
    // v2's drill-in.tsx:58-70: the focused crumb and variations share Escape-to-back.
    <LevelBack testID="products-variations-pane" onBack={() => setDrill(null)}>
      <View testID="products-crumb-row" className={`flex-row flex-wrap items-center gap-2 pb-2 ${gutter}`}>
        <BrowseCrumb key={drilled.id} autoFocus place={null} onRoot={() => setDrill(null)} product={{ name: drilled.name, onBack: () => setDrill(null) }} />
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
                  {variation.sku ? <Text testID={`products-phone-sku-${variation.id}`} numberOfLines={1} className="text-muted-foreground">{variation.sku}</Text> : null}
                </View>
                <View className="items-end gap-1">
                  <Text numberOfLines={1} className="text-foreground">{money(variation.price, currency, locale)}</Text>
                  <StockBadge doc={variation} quantity={stockQuantity(variation)} />
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          // In the doc's order, as v2's pane lists them (menu_order); its head row has no sort.
          <ProductTable testID="products-variations-body" items={variations} columns={paneColumns} sortItems={false} showUnsellable />
        )}
      </TableSurface>
    </LevelBack>
  ) : null;

  const body = total === 0 ? (
    <EmptyState kind="empty" title="No products yet" description="Products you add to the store will appear here." />
  ) : shown.length === 0 ? (
    <EmptyState kind="no-results" title="Nothing here matches the filters" action={{ label: 'Clear filters', onPress: clear }} />
  ) : narrow ? (
        <ScrollView testID="products-body">
          {listed.map(doc => (
            <View key={doc.id} testID={`products-row-${doc.id}`} className="flex-row items-center gap-3 border-b border-border px-4 py-3">
              <ProductImage doc={doc} size={IMAGE_SIZE} />
              <View className="flex-1 gap-1">
                <NameCell doc={doc} onDrill={drillTo} numberOfLines={1} showSku />
              </View>
              <View className="items-end gap-1">
                <Text numberOfLines={1} className="text-foreground">{priceText(doc, 'price', currency, locale)}</Text>
                <StockBadge doc={doc} quantity={stockQuantity(doc)} />
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <ProductTable testID="products-body" items={shown} columns={bodyColumns} defaultSort={NAME_ASC} showUnsellable />
      );

  return (
    <ConnectorProvider connector={connector} traitContext={{ currency }}>
      <View testID="screen-products" className="flex-1 bg-background">
        <AreaToolbar area="products" title="Products" onBack={onBack}
          search={<SearchInput testID="search-products" value={term} onChangeText={type} placeholder="Search products" />}>
          <AreaDisplayOptions area="products" columns={PRODUCTS_COLUMNS} settings={settings} onChange={setSettings}
            onOpenChange={setOptionsOpen} />
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
