// v2's Products area (WCPOS monorepo `packages/core/src/screens/main/products/products.tsx`), read-only: the default
// shown columns of ui-settings `initial-settings.json` "products" without Actions, name asc, and the cell rules of
// cells/name.tsx, stock-quantity.tsx, stock-status.tsx and price.tsx, with v2's English strings from core.json.
// Deviations: no inline editing, Manage toggle, variations drill-down, filter chips, Actions column or column
// settings, since edits must go through the store's REST API; the products collection is replicated from the
// server, so this screen takes plain docs and never touches it.
import { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { ConnectorProvider, formatMoney, moneyFromDecimalString } from '@tallyui/core';
import type { TallyConnector } from '@tallyui/core';
import { Badge, Button, ProductImage, ProductTable, SearchInput, Text } from '@tallyui/components';
import type { ProductTableColumn } from '@tallyui/components';
import { searchProducts, sortProducts } from '@tallyui/pos';
import type { ProductSort } from '@tallyui/pos';
import { resolveStock, STOCK_LABEL } from '../lib/products/resolve-stock';
import type { StockState } from '../lib/products/resolve-stock';

// v2's QuerySearchInput debounce (packages/core/src/screens/main/components/query-search-input.tsx:33).
const SEARCH_DEBOUNCE_MS = 250;
// The width below which the table becomes a list, as customers-screen.tsx.
const NARROW_WIDTH = 600;
// The image cell's square, about v2's thumbnail.
const IMAGE_SIZE = 40;
// v2's default sort for the products table (initial-settings.json "products").
const NAME_ASC: ProductSort = { field: 'name', dir: 'asc' };

const STOCK_VARIANT: Record<StockState, 'success' | 'destructive' | 'warning'> = {
  instock: 'success', outofstock: 'destructive', onbackorder: 'warning',
};

interface ProductDoc {
  id: number;
  name: string;
  type?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  manage_stock?: boolean;
  stock_quantity?: number | null;
  stock_status?: string;
  categories?: { name?: string }[];
  variations?: number[];
}

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

function variationsLine(doc: ProductDoc): string | null {
  if (doc.type !== 'variable') return null;
  const count = doc.variations?.length ?? 0;
  return count === 1 ? '1 variation' : `${count.toLocaleString()} variations`;
}

function countLabel(shown: number, total: number): string {
  if (shown < total) return `Showing ${shown.toLocaleString()} of ${total.toLocaleString()}`;
  return total === 1 ? '1 product' : `${total.toLocaleString()} products`;
}

function StockBadge({ doc }: { doc: ProductDoc }): JSX.Element {
  const state = resolveStock(doc);
  return <Badge testID={`product-stock-status-${doc.id}`} variant={STOCK_VARIANT[state]} className="self-start rounded-md" label={STOCK_LABEL[state]} />;
}

function NameCell({ doc }: { doc: ProductDoc }): JSX.Element {
  const line = variationsLine(doc);
  return (
    <View className="gap-1">
      <Text className="font-medium text-foreground">{doc.name}</Text>
      {line ? <Text testID={`product-variations-${doc.id}`} className="text-sm text-muted-foreground">{line}</Text> : null}
    </View>
  );
}

function productColumns(currency: string, locale: string | undefined): ProductTableColumn<ProductDoc>[] {
  const priceColumn = (id: 'price' | 'regular_price' | 'sale_price', header: string): ProductTableColumn<ProductDoc> => ({
    id, header, flex: 1,
    render: doc => <Text testID={`product-${id}-${doc.id}`}>{money(doc[id], currency, locale)}</Text>,
    sortValue: doc => priceValue(doc[id]),
  });
  return [
    { id: 'image', header: 'Image', flex: 0.6, render: doc => <ProductImage doc={doc} size={IMAGE_SIZE} /> },
    { id: 'name', header: 'Name', flex: 3, render: doc => <NameCell doc={doc} />, sortValue: doc => doc.name },
    { id: 'stock_quantity', header: 'Stock', flex: 1,
      render: doc => <Text testID={`product-stock-quantity-${doc.id}`}>{String(stockQuantity(doc) ?? '—')}</Text>,
      sortValue: doc => stockQuantity(doc) },
    { id: 'stock_status', header: 'Stock Status', flex: 1.4, render: doc => <StockBadge doc={doc} /> },
    { id: 'categories', header: 'Categories', flex: 2,
      render: doc => <Text>{(doc.categories ?? []).map(category => category.name).filter(Boolean).join(', ') || '—'}</Text> },
    priceColumn('price', 'Price'),
    priceColumn('regular_price', 'Regular Price'),
    priceColumn('sale_price', 'Sale Price'),
  ];
}

export function ProductsScreen({ products, connector, currency, locale: storeLocale, onBack }: ProductsScreenProps): JSX.Element {
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const { width } = useWindowDimensions();
  const locale = storeLocale?.replaceAll('_', '-');

  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  function clear() { setTerm(''); setQuery(''); }

  const columns = useMemo(() => productColumns(currency, locale), [currency, locale]);
  const shown = useMemo(() => query ? searchProducts(products, query, connector.traits.product) : products,
    [products, query, connector.traits.product]);
  const total = products.length;
  const narrow = width < NARROW_WIDTH;
  const listed = useMemo(() => narrow ? sortProducts([...shown], NAME_ASC,
    (doc, field) => columns.find(column => column.id === field)?.sortValue?.(doc)) as ProductDoc[] : [], [narrow, shown, columns]);

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
  ) : (
    <>
      {narrow ? (
        <ScrollView testID="products-body">
          {listed.map(doc => (
            <View key={doc.id} testID={`products-row-${doc.id}`} className="flex-row items-center gap-3 border-b border-border px-4 py-3">
              <ProductImage doc={doc} size={IMAGE_SIZE} />
              <View className="flex-1 gap-1">
                <Text numberOfLines={1} className="font-medium text-foreground">{doc.name}</Text>
                <Text numberOfLines={1} className="text-muted-foreground">{money(doc.price, currency, locale)}</Text>
              </View>
              <StockBadge doc={doc} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <ProductTable testID="products-body" items={shown} columns={columns} defaultSort={NAME_ASC} showUnsellable />
      )}
      <View className="border-t border-border px-4 py-2">
        <Text testID="data-table-count" className="text-sm text-muted-foreground">{countLabel(shown.length, total)}</Text>
      </View>
    </>
  );

  return (
    <ConnectorProvider connector={connector} traitContext={{ currency }}>
      <View testID="screen-products" className="flex-1 bg-background">
        <View className="flex-row items-center justify-between p-4">
          <Text accessibilityRole="header">Products</Text>
          <Button testID="products-back" onPress={onBack}><Text>Back</Text></Button>
        </View>
        <View className="px-4 pb-2">
          <SearchInput testID="search-products" value={term} onChangeText={setTerm} placeholder="Search products" />
        </View>
        {body}
      </View>
    </ConnectorProvider>
  );
}
