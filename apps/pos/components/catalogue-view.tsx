import { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { ConnectorProvider } from '@tallyui/core';
import type { TallyConnector } from '@tallyui/core';
import { Button, defaultProductColumns, ProductGrid, ProductTable, SearchInput, Text, ViewToggle } from '@tallyui/components';
import { productSortValue, resolveGridColumns, searchProducts, sortProducts } from '@tallyui/pos';
import { useCatalogueView } from '../lib/catalogue/catalogue-view-state';
import { useWedgeScanner } from '../lib/scan/use-wedge-scanner';
import { CatalogueDisplayOptions } from './catalogue-display-options';
import { ProductTile } from './product-tile';

export interface CatalogueViewProps {
  connector: TallyConnector;
  currency: string;
  products: any[];
  storeName: string;
  cashierName: string;
  status: 'idle' | 'starting' | 'syncing' | 'ready' | 'error';
  notice?: { code: string; message?: string };
  onSelect?(doc: any): void;
  onScan?(code: string): 'clear' | 'search' | 'keep';
  message?: string;
  onSignOut(): void;
  onOpenReports?(): void;
}

export function CatalogueView({
  connector, currency, products, storeName, cashierName, status, notice, onSignOut, onOpenReports, onSelect, onScan, message,
}: CatalogueViewProps): JSX.Element {
  const [term, setTerm] = useState('');
  function scan(code: string) {
    const result = onScan?.(code);
    if (result === 'clear') setTerm('');
    else if (result === 'search') setTerm(code);
  }
  useWedgeScanner(scan, Boolean(onScan));
  const [viewState, setViewState] = useCatalogueView();
  const { width } = useWindowDimensions();
  // Phones keep 2 tiles a row whatever the setting.
  const numColumns = width < 600 ? 2 : resolveGridColumns(viewState.gridColumns, width);
  const searching = Boolean(term.trim());
  const items = useMemo(() => {
    const searched = searching ? searchProducts(products, term, connector.traits.product) : products;
    return sortProducts([...searched], viewState.sort, (doc, field) => productSortValue(doc, field, connector.traits.product, { currency }));
  }, [products, term, searching, connector.traits.product, currency, viewState.sort]);
  const columns = useMemo(() => {
    const byId = new Map(defaultProductColumns(connector.traits.product, { currency }).map(column => [column.id, column]));
    return viewState.columns.filter(c => c.visible).flatMap(c => {
      const column = byId.get(c.id);
      return column ? [column] : [];
    });
  }, [connector.traits.product, currency, viewState.columns]);
  const searchSlot = <SearchInput value={term} onChangeText={setTerm} placeholder="Search name, SKU or barcode"
    onSubmitEditing={() => { const code = term.trim(); if (code && onScan) scan(code); }} />;
  const emptyState = <Text>{searching ? 'No products match' : 'No products yet'}</Text>;
  const statusLine = status === 'error' ? 'Sync failed' : notice ? notice.message ?? notice.code
    : status === 'syncing' ? 'Syncing products…' : status === 'ready' ? `${products.length} products` : '';

  return (
    <ConnectorProvider connector={connector} traitContext={{ currency }}>
      <View className="flex-1 bg-background p-4">
        <View className="flex-row flex-wrap items-center justify-between gap-4">
          <Text>{storeName}</Text>
          <Text>{`Cashier: ${cashierName}`}</Text>
          <ViewToggle value={viewState.view} onChange={view => setViewState({ ...viewState, view })} />
          <CatalogueDisplayOptions state={viewState} onChange={setViewState} />
          {onOpenReports && <Button onPress={onOpenReports}><Text>Reports</Text></Button>}
          <Button onPress={onSignOut}><Text>Sign out</Text></Button>
        </View>
        <Text>{statusLine}</Text>
        {message ? <Text>{message}</Text> : null}
        {viewState.view === 'grid' ? <ProductGrid
          items={items}
          numColumns={numColumns}
          renderItem={doc => <ProductTile doc={doc} fields={viewState.tileFields} onPress={onSelect ? () => onSelect(doc) : undefined} />}
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
