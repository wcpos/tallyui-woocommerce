import { useState } from 'react';
import type { JSX } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { ConnectorProvider } from '@tallyui/core';
import type { TallyConnector } from '@tallyui/core';
import { Button, ProductCard, ProductGrid, SearchInput, Text } from '@tallyui/components';
import { searchProducts } from '@tallyui/pos';

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
}

export function CatalogueView({
  connector, currency, products, storeName, cashierName, status, notice, onSignOut, onSelect, message,
}: CatalogueViewProps): JSX.Element {
  const [term, setTerm] = useState('');
  const { width } = useWindowDimensions();
  const searching = Boolean(term.trim());
  const items = searching ? searchProducts(products, term, connector.traits.product) : products;
  const statusLine = status === 'error' ? 'Sync failed' : notice ? notice.message ?? notice.code
    : status === 'syncing' ? 'Syncing products…' : status === 'ready' ? `${products.length} products` : '';

  return (
    <ConnectorProvider connector={connector} traitContext={{ currency }}>
      <View className="flex-1 bg-background p-4">
        <View className="flex-row items-center justify-between gap-4">
          <Text>{storeName}</Text>
          <Text>{`Cashier: ${cashierName}`}</Text>
          <Button onPress={onSignOut}><Text>Sign out</Text></Button>
        </View>
        <Text>{statusLine}</Text>
        {message ? <Text>{message}</Text> : null}
        <ProductGrid
          items={items}
          numColumns={width < 600 ? 2 : width >= 900 ? 4 : 3}
          renderItem={doc => <ProductCard doc={doc} onPress={onSelect ? () => onSelect(doc) : undefined} />}
          searchSlot={<SearchInput value={term} onChangeText={setTerm} placeholder="Search name, SKU or barcode" />}
          emptyState={<Text>{searching ? 'No products match' : 'No products yet'}</Text>}
        />
      </View>
    </ConnectorProvider>
  );
}
