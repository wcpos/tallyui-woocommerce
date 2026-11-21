// v2's Products area (WCPOS monorepo `packages/core/src/screens/main/products/products.tsx`), read-only: the default
// shown columns of ui-settings `initial-settings.json` "products" without Actions, name asc, and the cell rules of
// cells/name.tsx, stock-quantity.tsx, stock-status.tsx and price.tsx, with v2's English strings from core.json.
// Its filter chips are the catalogue's (v2 passes `chips={<FilterBar />}`), starting with none on, as v2 does. The
// bar's display options switch v2's columns (area-display-options.tsx).
// A variable product drills into its variations as v2's default 'drill' style does (products.tsx `drillTo`,
// `DrillPane`, pos/products/drill-in.tsx): the crumb "Products › <name>" over the variations, on their own card
// (`products-variations-surface`) under the table's labels, with the Stock Status chip applied to them; a search
// change drops the drill for good. The variations are the product doc's own `variation_docs`, as the catalogue's.
// The inline style expands rows in place (v2 `getRowCanExpand`); an attribute option chip opens the row unfiltered.
// Deviations: no inline editing, Manage toggle, Actions column or column reordering, since
// edits must go through the store's REST API; the products collection is replicated from the server, so this
// screen takes plain docs and never touches it. The Featured and Brands chips are still missing: they need
// connector data the app does not sync. The drilled view has no per-attribute variation selects or variation
// search: an option's match shows as one chip that clears it.
import { Fragment, useCallback, useMemo, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { ConnectorProvider, formatMoney, moneyFromDecimalString } from '@tallyui/core';
import type { ProductTraits, TallyConnector } from '@tallyui/core';
import { Button, ProductImage, ProductTable, SearchInput, Table, TableBody, TableCell, TableRow, Text, Tooltip, TooltipContent, TooltipTrigger } from '@tallyui/components';
import type { ProductTableColumn } from '@tallyui/components';
import { searchProducts, sortProducts } from '@tallyui/pos';
import type { ProductSort } from '@tallyui/pos';
import { resolveStock, STOCK_LABEL } from '../lib/products/resolve-stock';
import type { StockState } from '../lib/products/resolve-stock';
import { matchesCatalogueFilters } from '../lib/catalogue/quick-filters';
import type { CatalogueFilters } from '../lib/catalogue/quick-filters';
import { useCatalogueView, type VariationsStyle } from '../lib/catalogue/catalogue-view-state';
import { tileTaxLine } from '../lib/catalogue/tile-words';
import type { TileTax } from '../lib/catalogue/tile-words';
import { areaDisplayShown, useAreaColumns, visibleAreaColumns } from '../lib/area-columns';
import type { AreaColumn } from '../lib/area-columns';
import { NARROW_WIDTH } from '../lib/layout/wide';
import { usePointer } from '../lib/layout/pointer';
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
import { PlainAttributes, ProductAttributes, variationMatches, variationName, variationsFoundFor } from './product-attributes';
import type { ProductAttribute, VariationDoc, VariationMatch } from './product-attributes';
import { utcDate } from './coupons-screen';
import { BAR } from './customers-screen';
import { ChevronRightIcon } from './icons';
import { StatusDot } from './status-dot';
import { Segmented } from './segmented';
import { FieldLabel } from './select-chevron';
import { CaptionRowInset, TableCount, TableSurface, useCatalogueSync } from './table-surface';
import type { StatusTone } from './status-dot';

// The image cell's square, about v2's thumbnail.
const IMAGE_SIZE = 40;
const SYNCING_ROWS = Array.from({ length: 5 }, (_, i) => i); // v2's SYNCING_SKELETON_ROWS (data-table/index.tsx:198-201).
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
  // v2's name `display` (initial-settings.json:264-277): the lines its cell draws under the name, all off.
  { id: 'name', label: 'Product', visible: true, display: [{ id: 'sku', label: 'SKU', visible: false },
    { id: 'barcode', label: 'Barcode', visible: false }, { id: 'attributes', label: 'Attributes', visible: false }] },
  { id: 'type', label: 'Type', visible: false },
  { id: 'sku', label: 'SKU', visible: false },
  { id: 'barcode', label: 'Barcode', visible: false },
  { id: 'stock_quantity', label: 'Stock', visible: true },
  { id: 'stock_status', label: 'Stock Status', visible: true },
  { id: 'categories', label: 'Categories', visible: true },
  { id: 'tags', label: 'Tags', visible: false },
  // v2's price `display` (initial-settings.json:322-332): the tax line, off.
  { id: 'price', label: 'Price', visible: true, display: [{ id: 'tax', label: 'Tax', visible: false }] },
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
type ProductRow = ProductDoc | { id: string; variationOf: ProductDoc; variation: VariationDoc };

export interface ProductsScreenProps {
  /** Plain product docs, kept live by the catalogue; read only. */
  products: any[];
  connector: TallyConnector;
  currency: string;
  /** The store's locale, WordPress style (`en_US`) or BCP 47. */
  locale?: string;
  /** The caption row's start, v2's TableFooter children (products.tsx:270-276): the Tax based on trigger. */
  captionStart?: ReactNode;
  /** The till's tax settings for the Price cell's tax line (v2 PriceWithTax); none while taxes are off or the store
   *  settings are not in. */
  tax?: TileTax;
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
 *  range, one price when min equals max, else min and max; any other product shows its own field. */
function priceParts(doc: ProductDoc, field: PriceField, currency: string, locale: string | undefined): { min: string; max?: string } | null {
  if (doc.type !== 'variable' || (doc.variation_docs?.length ?? 0) === 0) return { min: money(doc[field], currency, locale) };
  const range = variationRange(doc, field);
  if (!range) return null;
  if (Number(range.min) === Number(range.max)) return { min: money(range.max, currency, locale) };
  return { min: money(range.min, currency, locale), max: money(range.max, currency, locale) };
}

/** The wide table's text: v2's `<Text> - </Text>` between min and max (variable-price.tsx). */
function priceText(doc: ProductDoc, field: PriceField, currency: string, locale: string | undefined): string {
  const parts = priceParts(doc, field, currency, locale);
  return !parts ? '' : parts.max ? `${parts.min} - ${parts.max}` : parts.min;
}

// v2's phone row (row.tsx:136-143): min, then an en dash (U+2013, the gap spaces it) and max only for a range.
const phonePrice = (parts: { min: string; max?: string } | null) => parts && <><Text numberOfLines={1} className="text-foreground">{parts.min}</Text>
  {parts.max ? <><Text className="text-foreground">–</Text><Text numberOfLines={1} className="text-foreground">{parts.max}</Text></> : null}</>;
// v2's Icon default, size-4.5 = 18 px (components/src/icon/index.tsx:27); a mark only, the row is not pressable.
const rowChevron = (id: number) => <ChevronRightIcon testID={`products-row-chevron-${id}`} size={18} className="text-muted-foreground" />;

/** v2's ProductStockBadge (cells/stock-status.tsx:43-57): a managed quantity reads before the word. */
function StockBadge({ doc, quantity }: { doc: ProductDoc | VariationDoc; quantity?: number }): JSX.Element {
  const state = resolveStock(doc);
  return <StatusDot testID={`product-stock-status-${doc.id}`} tone={STOCK_TONE[state]} label={quantity === undefined ? STOCK_LABEL[state] : `${quantity} · ${STOCK_LABEL[state]}`} />;
}

/** The Product column's display lines the display options leave on (v2's name `display`). */
type NameLines = Record<'sku' | 'barcode' | 'attributes', boolean>;

/** v2's ProductName (cells/name.tsx:48-51): the name, the display lines that are on (SKU, Barcode, Attributes), then
 *  ProductAttributes for a variable product. */
function NameCell({ doc, onDrill, numberOfLines, showSku, lines, expanded, found }: { doc: ProductDoc; onDrill: OnDrill; numberOfLines?: number; showSku?: boolean; lines?: NameLines; expanded?: boolean; found?: { count: number; term: string } }): JSX.Element {
  return (
    <View className={showSku ? undefined : 'gap-1'}>
      <Text numberOfLines={numberOfLines} className={showSku ? 'text-foreground' : 'font-medium text-foreground'}>{doc.name}</Text>
      {showSku && doc.sku ? <Text testID={`products-phone-sku-${doc.id}`} numberOfLines={1} className="text-sm text-muted-foreground">{doc.sku}</Text> : null}
      {lines?.sku && doc.sku ? <Text testID={`product-name-sku-${doc.id}`} className="text-sm text-foreground">{doc.sku}</Text> : null}
      {lines?.barcode && doc.barcode ? <Text testID={`product-name-barcode-${doc.id}`} className="text-sm text-foreground">{doc.barcode}</Text> : null}
      {lines?.attributes ? <PlainAttributes id={doc.id} attributes={doc.attributes} /> : null}
      {doc.type === 'variable' ? (
        <ProductAttributes id={doc.id} attributes={doc.attributes} count={doc.variations?.length ?? 0}
          options={!showSku} expanded={expanded} found={found} onDrill={match => onDrill(doc, match)} />
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

function VariationTouchRow({ variation, parent, currency, locale }: { variation: VariationDoc; parent: ProductDoc; currency: string; locale: string | undefined }): JSX.Element {
  return <View testID={`products-row-${variation.id}`} className="min-h-14 flex-row items-center gap-3 border-b border-border px-3 py-2">
    <ProductImage doc={parent} size={IMAGE_SIZE} />
    <View className="min-w-0 flex-1">
      <VariationNameCell variation={variation} parent={parent} />
      {variation.sku ? <Text testID={`products-phone-sku-${variation.id}`} numberOfLines={1} className="text-sm text-muted-foreground">{variation.sku}</Text> : null}
    </View>
    <View className="flex-row items-center gap-3">
      <View testID={`products-phone-figures-${variation.id}`} className="items-end gap-1 tabular-nums">
        <View testID={`products-phone-price-${variation.id}`} className="flex-row items-center gap-1">{phonePrice({ min: money(variation.price, currency, locale) })}</View>
        <StockBadge doc={variation} quantity={stockQuantity(variation)} />
      </View>
      {rowChevron(variation.id)}
    </View>
  </View>;
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

/** v2's PriceWithTax (components/product/price-with-tax.tsx:54-95, cells/price.tsx:24): a taxable price's "excl. / incl.
 *  {amount} tax" line under it while Price's Tax line is on (v2's `key` text), else as the price's tooltip. */
function PriceCell({ id, text, line, showTax }: { id: number | string; text: string; line: string | null; showTax: boolean }): JSX.Element {
  const price = <Text testID={`product-price-${id}`}>{text}</Text>;
  if (line === null) return price;
  if (showTax) return <View className="items-end gap-1">{price}<Text testID={`product-price-tax-${id}`} className="text-sm text-muted-foreground">{line}</Text></View>;
  // The hover wrapper is customers-screen.tsx's: a Text takes no hover, so a role-less Pressable does.
  return <Tooltip><TooltipTrigger asChild><Pressable testID={`product-price-trigger-${id}`} role="none" focusable={false}>{price}</Pressable></TooltipTrigger>
    <TooltipContent><Text>{line}</Text></TooltipContent></Tooltip>;
}

/** The Price cell's tax: the till's settings, the product traits, and whether Price's Tax line is on. */
interface PriceTax { tax?: TileTax; traits: ProductTraits; showTax: boolean }

/** Every column of PRODUCTS_COLUMNS, in its order; the screen hands ProductTable the ones left on. */
function productColumns(currency: string, locale: string | undefined, onDrill: OnDrill, lines: NameLines, { tax, traits, showTax }: PriceTax, inline: boolean, expanded: ReadonlySet<number>, term: string): (ProductTableColumn<ProductDoc> & { id: ProductsColumnId })[] {
  // The tile's tax words for one price (tile-words.ts tileTaxLine) with the doc's own tax status and class, so a variable
  // product's range ends take the parent's, as v2's VariableProductPrice passes them (variable-price.tsx:23-24).
  const taxLine = (doc: ProductDoc, price: string | undefined): string | null => {
    const money = tax ? moneyFromDecimalString(price ?? '', currency) : undefined;
    return money && tax ? tileTaxLine(money, traits.getTaxStatus?.(doc), traits.getTaxClass?.(doc), tax) : null;
  };
  // v2's VariableProductPrice (variable-price.tsx:45-71): one PriceWithTax(max) when min equals max, else min " - " max in
  // an end-justified wrapping row, each end with its own tax words; no range is an empty cell.
  const priceCell = (doc: ProductDoc): JSX.Element => {
    const ranged = doc.type === 'variable' && (doc.variation_docs?.length ?? 0) > 0;
    const range = ranged ? variationRange(doc, 'price') : undefined;
    const text = priceText(doc, 'price', currency, locale);
    if (!range || Number(range.min) === Number(range.max)) {
      return <PriceCell id={doc.id} text={text} line={taxLine(doc, ranged ? range?.max : doc.price)} showTax={showTax} />;
    }
    return <View testID={`product-price-${doc.id}`} className="flex-row flex-wrap items-center justify-end gap-1">
      <PriceCell id={`${doc.id}-min`} text={money(range.min, currency, locale)} line={taxLine(doc, range.min)} showTax={showTax} />
      <Text> - </Text>
      <PriceCell id={`${doc.id}-max`} text={money(range.max, currency, locale)} line={taxLine(doc, range.max)} showTax={showTax} />
    </View>;
  };
  // v2 sorts Price only; Regular and Sale Price are `disableSort` (initial-settings.json:323-349), all three `right`.
  const priceColumn = (id: PriceField) => ({
    id, header: LABEL[id], flex: 1, align: 'right' as const,
    render: (doc: ProductDoc) => id === 'price'
      ? priceCell(doc)
      : <Text testID={`product-${id}-${doc.id}`}>{priceText(doc, id, currency, locale)}</Text>,
    sortValue: id !== 'price' ? undefined : (doc: ProductDoc) => doc.type === 'variable' && (doc.variation_docs?.length ?? 0) > 0
      ? priceValue(variationRange(doc, id)?.min) : priceValue(doc[id]),
  });
  // v2's plain cells (no cell renderer: the field's text); sortable where v2's column has no `disableSort`.
  const textColumn = (id: 'type' | 'sku' | 'barcode', flex: number) => ({
    id, header: LABEL[id], flex,
    render: (doc: ProductDoc) => <Text testID={`product-${id}-${doc.id}`}>{doc[id] ?? ''}</Text>,
    sortValue: (doc: ProductDoc) => doc[id],
  });
  return [
    // v2's image column is unlabelled and unsorted (initial-settings.json:250-252 `hideLabel`, `disableSort`); TallyUI's
    // `hideHeader` draws no label and keeps "Image" as the head's accessible name. id, Stock, Stock Status centre (:256-299 `center`).
    { id: 'image', header: LABEL.image, hideHeader: true, flex: 0.6, render: doc => <ProductImage doc={doc} size={IMAGE_SIZE} /> },
    { id: 'id', header: LABEL.id, flex: 0.6, align: 'center', render: doc => <Text testID={`product-id-${doc.id}`}>{String(doc.id)}</Text>, sortValue: doc => doc.id },
    { id: 'name', header: LABEL.name, flex: 3, render: doc => <NameCell doc={doc} onDrill={onDrill} lines={lines} expanded={inline ? expanded.has(doc.id) : undefined}
      found={{ count: variationsFoundFor(traits.getVariants?.(doc) ?? [], term), term: term.trim() }} />, sortValue: doc => doc.name },
    textColumn('type', 1),
    textColumn('sku', 1),
    textColumn('barcode', 1.2),
    { id: 'stock_quantity', header: LABEL.stock_quantity, flex: 1, align: 'center',
      render: doc => <Text testID={`product-stock-quantity-${doc.id}`}>{String(stockQuantity(doc) ?? '—')}</Text>,
      sortValue: doc => stockQuantity(doc) },
    // Sortable in v2; the raw values order instock < onbackorder < outofstock.
    { id: 'stock_status', header: LABEL.stock_status, flex: 1.4, align: 'center', render: doc => <StockBadge doc={doc} />,
      sortValue: doc => resolveStock(doc) },
    { id: 'categories', header: LABEL.categories, flex: 2, render: doc => <Text>{termNames(doc.categories)}</Text> },
    { id: 'tags', header: LABEL.tags, flex: 2, render: doc => <Text testID={`product-tags-${doc.id}`}>{termNames(doc.tags)}</Text> },
    priceColumn('price'),
    priceColumn('regular_price'),
    priceColumn('sale_price'),
    // v2's RecordDateCell; derived on each render (v2's per-minute heartbeat refresh is not here).
    { id: 'date_modified_gmt', header: LABEL.date_modified_gmt, flex: 1.2,
      render: doc => <Text testID={`product-date_modified_gmt-${doc.id}`}>{gmtAgoText(doc.date_modified_gmt, locale, new Date())}</Text> },
  ];
}

/** v2 use-date-format.tsx: under 24 hours old (differenceInHours, truncated) date-fns formatDistance with addSuffix,
 *  else 'MMMM d, yyyy' in the locale; '' when empty or unreadable. A future date (clock skew) reads as the date. */
export function gmtAgoText(value: string | undefined, locale: string | undefined, now: Date): string {
  const date = value ? utcDate(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const seconds = (now.getTime() - date.getTime()) / 1000;
  const minutes = Math.round(seconds / 60);
  if (seconds >= 0 && seconds < 24 * 3600) return `${minutes === 0 ? 'less than a minute' : minutes < 2 ? '1 minute'
    : minutes < 45 ? `${minutes} minutes` : minutes < 90 ? 'about 1 hour' : `about ${Math.round(minutes / 60)} hours`} ago`;
  const options = { day: 'numeric', month: 'long', year: 'numeric' } as const;
  try {
    return date.toLocaleDateString(locale, options);
  } catch {
    return date.toLocaleDateString(undefined, options);
  }
}

// The cell's align as TallyUI's ProductTable maps it (left items-start, center items-center, right items-end).
const ITEMS = { left: 'items-start', center: 'items-center', right: 'items-end' } as const;

/** v2's body cell centres its content on the row (components/src/table/index.tsx:129 `flex-col justify-center`).
 *  ProductTableColumn takes no cell class, so each column's own content fills the cell and centres itself; the
 *  wrapper takes the column's align too, so a centred or right column's content keeps its place. */
function centred<Doc extends { id: number }>(columns: ProductTableColumn<Doc>[]): ProductTableColumn<Doc>[] {
  return columns.map(column => ({
    ...column,
    render: (doc: Doc) => <View testID={`product-cell-${column.id}-${doc.id}`}
      className={column.align ? `flex-1 justify-center ${ITEMS[column.align]}` : 'flex-1 justify-center'}>
      {column.render(doc)}
    </View>,
  }));
}

/** v2's variationCells over the products table's shown columns, under plain labels (DrillPane's PaneHeadRow): the
 *  variation's own fields where it has them, the parent's image, ProductVariationName, and empty terms. */
function variationColumns(columns: (ProductTableColumn<ProductDoc> & { id: ProductsColumnId })[], parent: ProductDoc)
  : ProductTableColumn<VariationDoc>[] {
  return columns.map(({ id, header, flex, align, hideHeader, render }) => ({
    id, header, flex, align, hideHeader,
    render: (variation: VariationDoc) => id === 'image' ? <ProductImage doc={parent} size={IMAGE_SIZE} />
      : id === 'name' ? <VariationNameCell variation={variation} parent={parent} />
        : id === 'categories' || id === 'tags' ? null
          : render({ ...variation, name: variationName(variation, parent.name) }),
  }));
}

export function ProductsScreen({ products, connector, currency, locale: storeLocale, captionStart, tax, onBack }: ProductsScreenProps): JSX.Element {
  const { term, query, type, set } = useSearchTerm();
  // v2's page gutter (ground.ts:46-72): the crumb and chip rows sit on the bar's 12 in a window, 16 on a phone.
  const gutter = useAreaGutter();
  // v2's Products area lists every product, in stock or not: no chip is on at the start.
  const [filters, setFilters] = useState<CatalogueFilters>({});
  const [settings, setSettings] = useAreaColumns('products', PRODUCTS_COLUMNS);
  const [view, setView] = useCatalogueView();
  const inline = view.variationsStyle === 'inline';
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set());
  const [sort, setSort] = useState<ProductSort | null>(NAME_ASC);
  const [drill, setDrill] = useState<Drill | null>(null);
  const { width } = useWindowDimensions();
  const pointer = usePointer();
  const sync = useCatalogueSync();
  const locale = storeLocale?.replaceAll('_', '-');

  // v2's drill holds while the search it was opened under does (products.tsx `drilled`); otherwise it is dropped,
  // not parked, so restoring the search does not bring it back. Reset while rendering, React's "previous render"
  // pattern, as v2 does. A product gone from the docs drops it too.
  const drilled = !inline && drill && drill.query === query ? (products as ProductDoc[]).find(doc => doc.id === drill.id) : undefined;
  if (drill && !drilled) setDrill(null);
  if (!inline && expanded.size > 0) setExpanded(new Set());
  const drillTo = useCallback<OnDrill>((doc, match) => {
    if (inline) setExpanded(previous => {
      const next = new Set(previous);
      if (match || !next.has(doc.id)) next.add(doc.id); else next.delete(doc.id);
      return next;
    });
    else setDrill({ id: doc.id, query, match });
  }, [inline, query]);

  function clear() { set(''); setFilters({}); }
  const filtersOn = Object.values(filters).filter(value => Array.isArray(value) ? value.length > 0 : value !== undefined && value !== '').length;

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

  const [sku, barcode, attributes] = (['sku', 'barcode', 'attributes'] as const).map(key => areaDisplayShown(settings, 'name', key));
  const showTax = areaDisplayShown(settings, 'price', 'tax');
  const columns = useMemo(() => productColumns(currency, locale, drillTo, { sku, barcode, attributes }, { tax, traits: connector.traits.product, showTax }, inline, expanded, query),
    [currency, locale, drillTo, sku, barcode, attributes, tax, connector.traits.product, showTax, inline, expanded, query]);
  // The columns the display options leave on, in the area's order; the narrow list keeps sorting on every column.
  const tableColumns = useMemo(() => visibleAreaColumns(columns, settings), [columns, settings]);
  const searched = useMemo(() => query ? searchProducts(products, query, connector.traits.product) : products,
    [products, query, connector.traits.product]);
  const shown = useMemo(() => searched.filter(doc => matchesCatalogueFilters(doc, filters)), [searched, filters]);
  const total = products.length;
  // v2 picks the row by pointer (list-frame/index.tsx:158); the first-sync placeholders follow the row they stand in for.
  const touchRows = width < NARROW_WIDTH || pointer === 'coarse';
  const listed = useMemo(() => sortProducts([...shown], touchRows ? NAME_ASC : sort,
    (doc, field) => columns.find(column => column.id === field)?.sortValue?.(doc)) as ProductDoc[], [touchRows, shown, columns, sort]);
  const items = useMemo(() => listed.flatMap<ProductRow>(doc => inline && expanded.has(doc.id) && doc.type === 'variable'
    ? [doc, ...drilledVariations(doc, filters, undefined).map(variation => ({ id: `variation-${variation.id}`, variationOf: doc, variation }))]
    : [doc]), [listed, inline, expanded, filters]);
  const variations = useMemo(() => drilled ? drilledVariations(drilled, filters, drill?.match) : [], [drilled, filters, drill?.match]);
  const bodyColumns = useMemo(() => centred(tableColumns).map(column => ({ ...column, render: (item: ProductRow) => {
    if (!('variationOf' in item)) return column.render(item);
    const cell = centred(variationColumns(tableColumns, item.variationOf)).find(cell => cell.id === column.id)!.render(item.variation);
    return column.id === 'name' ? <View testID={`products-variation-row-${item.variation.id}`} className="flex-1 pl-6">{cell}</View> : cell;
  } })), [tableColumns]);
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
        {variations.length === 0 ? noVariations : touchRows ? (
          <ScrollView testID="products-variations-body">
            {variations.map(variation => <VariationTouchRow key={variation.id} variation={variation} parent={drilled} currency={currency} locale={locale} />)}
          </ScrollView>
        ) : (
          // In the doc's order, as v2's pane lists them (menu_order); its head row has no sort.
          <ProductTable testID="products-variations-body" items={variations} columns={paneColumns} sortItems={false} showUnsellable />
        )}
      </TableSurface>
    </LevelBack>
  ) : null;

  // v2's ListEmptyComponent (data-table/index.tsx:392-414) and DataTableSkeletonRows (skeleton.tsx:34-69): mid-sync an
  // empty list is rows in flight, not "No products yet". ProductTable drops its header with no rows, so bars only.
  const body = total === 0 && sync.active ? (
    <View testID="products-syncing-rows" accessibilityLabel="Loading products…" aria-busy className="flex-1 overflow-hidden">
      {touchRows ? SYNCING_ROWS.map(i => (
        <View key={i} testID={`products-syncing-row-${i}`} className="min-h-14 flex-row items-center gap-3 border-b border-border px-3 py-2">
          <View className="h-10 w-10 rounded bg-muted" />
          <View className="flex-1 gap-1"><View className={BAR} /><View className="h-5 w-1/2 rounded-lg bg-muted" /></View>
        </View>
      )) : <Table><TableBody>{SYNCING_ROWS.map(i => <TableRow key={i} testID={`products-syncing-row-${i}`}>
        {tableColumns.map(({ id, flex }) => <TableCell key={id} style={{ flex: flex ?? 1 }} className="justify-center px-3 py-1.5">
          <View testID={`products-syncing-bar-${id}`} className={id === 'image' ? 'h-10 w-10 rounded bg-muted' : BAR} />
        </TableCell>)}
      </TableRow>)}</TableBody></Table>}
    </View>
  ) : total === 0 ? (
    <EmptyState kind="empty" title="No products yet" description="Products you add to the store will appear here." />
  ) : shown.length === 0 ? (
    <EmptyState kind="no-results" title="Nothing here matches the filters" action={{ label: 'Clear filters', onPress: clear }} />
  ) : touchRows ? (
        // A phone row is v2's ListRow (list-row/index.tsx:31,54-65): min-h-14 px-3 py-2, a min-w-0 body, a regular-weight name over a text-sm SKU.
        <ScrollView testID="products-body">
          {listed.map(doc => (
            <Fragment key={doc.id}><View testID={`products-row-${doc.id}`} className="min-h-14 flex-row items-center gap-3 border-b border-border px-3 py-2">
              <ProductImage doc={doc} size={IMAGE_SIZE} />
              <View className="min-w-0 flex-1">
                <NameCell doc={doc} onDrill={drillTo} numberOfLines={1} showSku expanded={inline ? expanded.has(doc.id) : undefined}
                  found={{ count: variationsFoundFor(connector.traits.product.getVariants?.(doc) ?? [], query), term: query.trim() }} />
              </View>
              <View className="flex-row items-center gap-3">
                <View testID={`products-phone-figures-${doc.id}`} className="items-end gap-1 tabular-nums">
                  <View testID={`products-phone-price-${doc.id}`} className="flex-row items-center gap-1">{phonePrice(priceParts(doc, 'price', currency, locale))}</View>
                  <StockBadge doc={doc} quantity={stockQuantity(doc)} />
                </View>
                {rowChevron(doc.id)}
              </View>
            </View>
            {inline && expanded.has(doc.id) && doc.type === 'variable' && drilledVariations(doc, filters, undefined)
              .map(variation => <VariationTouchRow key={variation.id} variation={variation} parent={doc} currency={currency} locale={locale} />)}</Fragment>
          ))}
        </ScrollView>
      ) : (
        <ProductTable testID="products-body" items={items} columns={bodyColumns} sortItems={false} sort={sort} onSortChange={setSort} showUnsellable />
      );

  return (
    <ConnectorProvider connector={connector} traitContext={{ currency }}>
      <View testID="screen-products" className="flex-1 bg-background">
        <AreaToolbar area="products" title="Products" onBack={onBack}
          search={<SearchInput testID="search-products" value={term} onChangeText={type} placeholder="Search products" />}>
          <AreaDisplayOptions area="products" columns={PRODUCTS_COLUMNS} settings={settings} onChange={setSettings}
            onOpenChange={setOptionsOpen} before={<View className="gap-1.5">
              <FieldLabel>Variations</FieldLabel>
              <Segmented testID="products-variations-style" label="Variations" value={view.variationsStyle}
                segments={[{ value: 'drill', label: 'Open in place' }, { value: 'inline', label: 'Expanded rows' }]}
                onChange={next => setView({ ...view, variationsStyle: next as VariationsStyle })} />
            </View>} />
        </AreaToolbar>
        <View testID="products-filter-row" className={`pb-2 ${gutter}`}>
          {/* v2's ChipRow (chip-row/index.tsx:29-37): the chips stay on one row that scrolls sideways at every width. */}
          <ScrollView testID="products-chip-row" horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
            contentContainerClassName="items-center gap-2">
            {/* v2's `changed >= 2` Clear all (components/product/filter-bar/index.tsx:25-31,61-65): the filters only; the search stays. */}
            <CatalogueFilterChips products={products} filters={filters} onChange={setFilters} trailing={filtersOn >= 2
              ? <Button testID="products-filter-clear-all" variant="ghost" onPress={() => setFilters({})}><Text>Clear all</Text></Button> : undefined} />
          </ScrollView>
        </View>
        {drilled ? pane : <TableSurface testID="products-table-surface">{body}</TableSurface>}
        {drilled ? (
          // v2's VariationTableFooter: the parent's own variation list is the total, never fewer than are drawn.
          variations.length > 0 && <CaptionRowInset>
            <TableCount shown={variations.length} total={Math.max(drilled.variations?.length ?? 0, variations.length)}
              active={sync.active} onSync={sync.sync} />
          </CaptionRowInset>
        ) : shown.length > 0 && (
          // v2 data-table/footer.tsx:52-55: the caption start fills the row, the count and sync keep their width.
          <CaptionRowInset><View className="flex-row items-center">
            <View testID="products-caption-start" className="min-w-0 flex-1 flex-row items-center">{captionStart}</View>
            <TableCount shown={shown.length} total={total} active={sync.active} onSync={sync.sync} />
          </View></CaptionRowInset>
        )}
      </View>
    </ConnectorProvider>
  );
}
