import { useMemo, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { ConnectorProvider } from '@tallyui/core';
import type { TallyConnector } from '@tallyui/core';
import { Button, defaultProductColumns, ProductGrid, ProductTable, SearchInput, Text, ViewToggle } from '@tallyui/components';
import { productSortValue, resolveGridColumns, searchProducts, sortProducts } from '@tallyui/pos';
import type { ProductSort } from '@tallyui/pos';
import { useCatalogueView } from '../lib/catalogue/catalogue-view-state';
import type { AppCatalogueViewState } from '../lib/catalogue/catalogue-view-state';
import { isQuickFilterActive, matchesCatalogueFilters, quickFilterToQueryPatch, useQuickFilters } from '../lib/catalogue/quick-filters';
import type { CatalogueFilters, QuickFilter } from '../lib/catalogue/quick-filters';
import { useWedgeScanner } from '../lib/scan/use-wedge-scanner';
import { CatalogueDisplayOptions } from './catalogue-display-options';
import { FilterBarDialog } from './filter-bar-dialog';
import { ProductTile } from './product-tile';
import { QuickFilterBar } from './quick-filter-bar';

export interface CatalogueViewProps {
  connector: TallyConnector;
  currency: string;
  products: any[];
  storeName: string;
  cashierName: string;
  cashierControl?: ReactNode;
  status: 'idle' | 'starting' | 'syncing' | 'ready' | 'error';
  notice?: { code: string; message?: string };
  onSelect?(doc: any): void;
  onScan?(code: string): 'clear' | 'search' | 'keep';
  message?: string;
  onSignOut(): void;
  onOpenReports?(): void;
  onOpenHealth?(): void;
  viewState?: AppCatalogueViewState;
  onViewStateChange?(next: AppCatalogueViewState): void;
}

export function CatalogueView({
  connector, currency, products, storeName, cashierName, cashierControl, status, notice, onSignOut, onOpenReports, onOpenHealth, onSelect, onScan, message,
  viewState: controlledViewState, onViewStateChange,
}: CatalogueViewProps): JSX.Element {
  const [term, setTerm] = useState('');
  const [quickFilters, setQuickFilters] = useQuickFilters();
  const [filters, setFilters] = useState<CatalogueFilters>({});
  const [sortOverride, setSortOverride] = useState<ProductSort | null>(null);
  function scan(code: string) {
    const result = onScan?.(code);
    if (result === 'clear') setTerm('');
    else if (result === 'search') setTerm(code);
  }
  useWedgeScanner(scan, Boolean(onScan));
  const [ownViewState, setOwnViewState] = useCatalogueView();
  const viewState = controlledViewState ?? ownViewState;
  const setViewState = onViewStateChange ?? setOwnViewState;
  const sort = sortOverride ?? viewState.sort;
  const { width } = useWindowDimensions();
  // Phones keep 2 tiles a row whatever the setting.
  const numColumns = width < 600 ? 2 : resolveGridColumns(viewState.gridColumns, width);
  const searching = Boolean(term.trim());
  const filtered = Object.keys(filters).length > 0;
  const items = useMemo(() => {
    const matching = products.filter(doc => matchesCatalogueFilters(doc, filters));
    const searched = searching ? searchProducts(matching, term, connector.traits.product) : matching;
    return sortProducts([...searched], sort, (doc, field) => productSortValue(doc, field, connector.traits.product, { currency }));
  }, [products, filters, term, searching, connector.traits.product, currency, sort]);
  const columns = useMemo(() => {
    const byId = new Map(defaultProductColumns(connector.traits.product, { currency }).map(column => [column.id, column]));
    return viewState.columns.filter(c => c.visible).flatMap(c => {
      const column = byId.get(c.id);
      return column ? [column] : [];
    });
  }, [connector.traits.product, currency, viewState.columns]);
  const queryState = { filters, search: term, sort };
  const isActive = (qf: QuickFilter) => isQuickFilterActive(qf, queryState, viewState.sort);
  // Like v2, a press replaces the whole filter state, and pressing the active button restores the baseline.
  function pressQuickFilter(qf: QuickFilter) {
    if (isActive(qf)) {
      setFilters({});
      setTerm('');
      setSortOverride(null);
    } else {
      const patch = quickFilterToQueryPatch(qf);
      setFilters(patch.filters);
      setTerm(patch.search);
      setSortOverride(qf.sort ?? null);
    }
  }
  function changeQuickFilters(next: QuickFilter[]) {
    // Without v2's filter pills nothing would show the filters of an applied quick filter that was deleted or changed, so reset.
    const applied = quickFilters.find(isActive);
    if (applied && !next.some(qf => qf.id === applied.id && isActive(qf))) { setFilters({}); setTerm(''); setSortOverride(null); }
    setQuickFilters(next);
  }
  const searchSlot = <View className="gap-2"><SearchInput value={term} onChangeText={setTerm} placeholder="Search name, SKU or barcode"
    onSubmitEditing={() => { const code = term.trim(); if (code && onScan) scan(code); }} />
    <View className="flex-row items-start gap-2">
      <View className="flex-1"><QuickFilterBar quickFilters={quickFilters} isActive={isActive} onPress={pressQuickFilter} /></View>
      <FilterBarDialog quickFilters={quickFilters} onChange={changeQuickFilters} products={products} connector={connector} currency={currency} baselineSort={viewState.sort} />
    </View>
  </View>;
  const emptyState = <Text>{searching || filtered ? 'No products match' : 'No products yet'}</Text>;
  const statusLine = status === 'error' ? 'Sync failed' : notice ? notice.message ?? notice.code
    : status === 'syncing' ? 'Syncing products…' : status === 'ready' ? `${products.length} products` : '';

  return (
    <ConnectorProvider connector={connector} traitContext={{ currency }}>
      <View className="flex-1 bg-background p-4">
        <View className="flex-row flex-wrap items-center justify-between gap-4">
          <Text>{storeName}</Text>
          {cashierControl ?? <Text>{`Cashier: ${cashierName}`}</Text>}
          <ViewToggle value={viewState.view} onChange={view => setViewState({ ...viewState, view })} />
          <CatalogueDisplayOptions state={viewState} onChange={setViewState} />
          {onOpenReports && <Button onPress={onOpenReports}><Text>Reports</Text></Button>}
          {onOpenHealth && <Button testID="health-navigation" onPress={onOpenHealth}><Text>Store health</Text></Button>}
          {cashierControl == null && <Button onPress={onSignOut}><Text>Sign out</Text></Button>}
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
          sort={sort}
          onSortChange={next => { setSortOverride(null); setViewState({ ...viewState, sort: next }); }}
          onSelect={onSelect}
          searchSlot={searchSlot}
          emptyState={emptyState}
        />}
      </View>
    </ConnectorProvider>
  );
}
