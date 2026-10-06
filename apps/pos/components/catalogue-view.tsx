import { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { ConnectorProvider } from '@tallyui/core';
import type { TallyConnector } from '@tallyui/core';
import { Button, defaultProductColumns, ProductCard, ProductGrid, ProductTable, SearchInput, Text, ViewToggle } from '@tallyui/components';
import { productSortValue, searchProducts, sortProducts } from '@tallyui/pos';
import { useCatalogueView } from '../lib/catalogue/catalogue-view-state';

export interface CatalogueViewProps {
  connector: TallyConnector;
  currency: string;
  products: any[];
  storeName: string;
  cashierName: string;
  status: 'idle' | 'starting' | 'syncing' | 'ready' | 'error';
  notice?: { code: string; message?: string };
  onSelect?(doc: any): void;
  message?: string;
  onSignOut(): void;
  onOpenReports?(): void;
}

export function CatalogueView({
  connector, currency, products, storeName, cashierName, status, notice, onSignOut, onOpenReports, onSelect, message,
}: CatalogueViewProps): JSX.Element {
  const [term, setTerm] = useState('');
  const [viewState, setViewState] = useCatalogueView();
  const { width } = useWindowDimensions();
  const searching = Boolean(term.trim());
  const items = useMemo(() => {
    const searched = searching ? searchProducts(products, term, connector.traits.product) : products;
    return sortProducts([...searched], viewState.sort, (doc, field) => productSortValue(doc, field, connector.traits.product, { currency }));
  }, [products, term, searching, connector.traits.product, currency, viewState.sort]);
  const columns = useMemo(() => defaultProductColumns(connector.traits.product, { currency })
    .filter(column => ['name', 'price', 'stock', 'category'].includes(column.id)), [connector.traits.product, currency]);
  const searchSlot = <SearchInput value={term} onChangeText={setTerm} placeholder="Search name, SKU or barcode" />;
  const emptyState = <Text>{searching ? 'No products match' : 'No products yet'}</Text>;
  const statusLine = status === 'error' ? 'Sync failed' : notice ? notice.message ?? notice.code
    : status === 'syncing' ? 'Syncing products…' : status === 'ready' ? `${products.length} products` : '';

  return (
    <ConnectorProvider connector={connector} traitContext={{ currency }}>
      <View className="flex-1 bg-background p-4">
        <View className="flex-row items-center justify-between gap-4">
          <Text>{storeName}</Text>
          <Text>{`Cashier: ${cashierName}`}</Text>
          <ViewToggle value={viewState.view} onChange={view => setViewState({ ...viewState, view })} />
          {onOpenReports && <Button onPress={onOpenReports}><Text>Reports</Text></Button>}
          <Button onPress={onSignOut}><Text>Sign out</Text></Button>
        </View>
        <Text>{statusLine}</Text>
        {message ? <Text>{message}</Text> : null}
        {viewState.view === 'grid' ? <ProductGrid
          items={items}
          numColumns={width < 600 ? 2 : width >= 900 ? 4 : 3}
          renderItem={doc => <ProductCard doc={doc} onPress={onSelect ? () => onSelect(doc) : undefined} />}
          searchSlot={searchSlot}
          emptyState={emptyState}
        /> : <ProductTable
          items={items}
          sortItems={false}
          columns={columns}
          sort={viewState.sort}
          onSortChange={sort => setViewState({ ...viewState, sort })}
          onSelect={onSelect}
          searchSlot={searchSlot}
          emptyState={emptyState}
        />}
      </View>
    </ConnectorProvider>
  );
}
