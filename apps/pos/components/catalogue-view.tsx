import { useMemo, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { ConnectorProvider } from '@tallyui/core';
import type { TallyConnector } from '@tallyui/core';
import { Button, defaultProductColumns, ProductGrid, ProductTable, SearchInput, Text, ViewToggle } from '@tallyui/components';
import type { ProductTableColumn } from '@tallyui/components';
import { productSortValue, resolveGridColumns, searchProducts, sortProducts } from '@tallyui/pos';
import type { ProductSort } from '@tallyui/pos';
import { useCatalogueView } from '../lib/catalogue/catalogue-view-state';
import type { AppCatalogueViewState } from '../lib/catalogue/catalogue-view-state';
import { catalogueFilterBaseline, isQuickFilterActive, matchesCatalogueFilters, quickFilterToQueryPatch, rebaseStockStatus, useQuickFilters } from '../lib/catalogue/quick-filters';
import type { CatalogueFilters, QuickFilter } from '../lib/catalogue/quick-filters';
import type { TileTax } from '../lib/catalogue/tile-words';
import { useWedgeScanner } from '../lib/scan/use-wedge-scanner';
import { CatalogueDisplayOptions } from './catalogue-display-options';
import { CatalogueFilterChips } from './catalogue-filter-chips';
import { DrawerSheet } from './drawer-content';
import { FilterBarDialog } from './filter-bar-dialog';
import { InCartBadge } from './in-cart-badge';
import { ProductTile } from './product-tile';
import { QuickFilterBar } from './quick-filter-bar';
import { RegisterBarShell } from './register-bar-shell';

export interface CatalogueViewProps {
  connector: TallyConnector;
  currency: string;
  products: any[];
  storeName: string;
  cashierName: string;
  cashierControl?: ReactNode;
  /** Sessions on at the wide split: the register bar beside the catalogue carries the pill, so this bar draws none (v2: one pill per window). */
  hideOfflineBadge?: boolean;
  status: 'idle' | 'starting' | 'syncing' | 'ready' | 'error';
  notice?: { code: string; message?: string };
  onSelect?(doc: any): void;
  onScan?(code: string): 'clear' | 'search' | 'keep';
  message?: string;
  onSignOut(): void;
  onOpenOrders?(): void;
  onOpenCustomers?(): void;
  onOpenReports?(): void;
  onOpenHealth?(): void;
  onOpenLogs?(): void;
  onOpenSettings?(): void;
  viewState?: AppCatalogueViewState;
  onViewStateChange?(next: AppCatalogueViewState): void;
  /** The till's tax, for the tiles' Tax field; without it the field shows nothing. */
  tax?: TileTax;
  /** In-cart quantity by product id (SaleScreen's lines); without it no badge shows. */
  inCartCounts?: ReadonlyMap<string, number>;
}

export function CatalogueView({
  connector, currency, products, storeName, cashierName, cashierControl, hideOfflineBadge, status, notice, onSignOut, onOpenOrders, onOpenCustomers, onOpenReports, onOpenHealth, onOpenLogs, onOpenSettings, onSelect, onScan, message,
  viewState: controlledViewState, onViewStateChange,
  tax, inCartCounts,
}: CatalogueViewProps): JSX.Element {
  const [term, setTerm] = useState('');
  const [quickFilters, setQuickFilters] = useQuickFilters();
  const [sortOverride, setSortOverride] = useState<ProductSort | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  function scan(code: string) {
    const result = onScan?.(code);
    if (result === 'clear') setTerm('');
    else if (result === 'search') setTerm(code);
  }
  useWedgeScanner(scan, Boolean(onScan));
  const [ownViewState, setOwnViewState] = useCatalogueView();
  const viewState = controlledViewState ?? ownViewState;
  const setViewState = onViewStateChange ?? setOwnViewState;
  const [filters, setFilters] = useState<CatalogueFilters>(() => catalogueFilterBaseline(viewState.showOutOfStock));
  const baseline = catalogueFilterBaseline(viewState.showOutOfStock);
  // As v2: the stock filter rebases only when the setting moves, and a sort set in the sheet replaces a quick filter's.
  function changeViewState(next: AppCatalogueViewState) {
    if (next.showOutOfStock !== viewState.showOutOfStock) setFilters(current => rebaseStockStatus(current, next.showOutOfStock));
    if (next.sort !== viewState.sort) setSortOverride(null);
    setViewState(next);
  }
  const sort = sortOverride ?? viewState.sort;
  const { width } = useWindowDimensions();
  // Phones keep 2 tiles a row whatever the setting.
  const numColumns = width < 600 ? 2 : resolveGridColumns(viewState.gridColumns, width);
  const searching = Boolean(term.trim());
  const items = useMemo(() => {
    const matching = products.filter(doc => matchesCatalogueFilters(doc, filters));
    const searched = searching ? searchProducts(matching, term, connector.traits.product) : matching;
    return sortProducts([...searched], sort, (doc, field) => productSortValue(doc, field, connector.traits.product, { currency }));
  }, [products, filters, term, searching, connector.traits.product, currency, sort]);
  const columns = useMemo(() => {
    const byId = new Map(defaultProductColumns(connector.traits.product, { currency }).map(column => [column.id, column]));
    const visible: ProductTableColumn[] = viewState.columns.filter(c => c.visible).flatMap(c => {
      const column = byId.get(c.id);
      return column ? [column] : [];
    });
    if (inCartCounts) visible.push({ id: 'in_cart', header: '', flex: 0.5, render: doc => {
      const id = connector.traits.product.getId(doc);
      return <InCartBadge count={inCartCounts.get(id) ?? 0} testID={`in-cart-row-${id}`} />;
    } });
    return visible;
  }, [connector.traits.product, currency, viewState.columns, inCartCounts]);
  const queryState = { filters, search: term, sort };
  const isActive = (qf: QuickFilter) => isQuickFilterActive(qf, queryState, viewState.sort, baseline);
  // Like v2, a press replaces the whole filter state, and pressing the active button restores the baseline.
  function pressQuickFilter(qf: QuickFilter) {
    if (isActive(qf)) {
      setFilters(baseline);
      setTerm('');
      setSortOverride(null);
    } else {
      const patch = quickFilterToQueryPatch(qf);
      setFilters({ ...baseline, ...patch.filters });
      setTerm(patch.search);
      setSortOverride(qf.sort ?? null);
    }
  }
  function changeQuickFilters(next: QuickFilter[]) {
    // An applied quick filter that was deleted or changed resets the catalogue to the baseline.
    const applied = quickFilters.find(isActive);
    if (applied && !next.some(qf => qf.id === applied.id && isActive(qf))) { setFilters(baseline); setTerm(''); setSortOverride(null); }
    setQuickFilters(next);
  }
  const searchSlot = <View className="gap-2"><SearchInput value={term} onChangeText={setTerm} placeholder="Search name, SKU or barcode"
    onSubmitEditing={() => { const code = term.trim(); if (code && onScan) scan(code); }} />
    <View className="flex-row flex-wrap items-center gap-2">
      <CatalogueFilterChips products={products} filters={filters} onChange={setFilters} />
      <QuickFilterBar quickFilters={quickFilters} isActive={isActive} onPress={pressQuickFilter} />
      <FilterBarDialog quickFilters={quickFilters} onChange={changeQuickFilters} products={products} connector={connector} currency={currency} baselineSort={viewState.sort} />
    </View>
  </View>;
  const emptyState = <Text>{searching || products.length > 0 ? 'No products match' : 'No products yet'}</Text>;
  const statusLine = status === 'error' ? 'Sync failed' : notice ? notice.message ?? notice.code
    : status === 'syncing' ? 'Syncing products…' : status === 'ready' ? `${products.length} products` : '';

  return (
    <ConnectorProvider connector={connector} traitContext={{ currency }}>
      <View className="flex-1 bg-background">
        <RegisterBarShell storeName={storeName} hidePill={hideOfflineBadge} onOpenMenu={() => setDrawerOpen(true)}
          avatar={<>
            {cashierControl ?? <Text>{`Cashier: ${cashierName}`}</Text>}
            {cashierControl == null && <Button onPress={onSignOut}><Text>Sign out</Text></Button>}
          </>} />
        <DrawerSheet open={drawerOpen} onOpenChange={setDrawerOpen}
          onOpenOrders={onOpenOrders} onOpenCustomers={onOpenCustomers} onOpenReports={onOpenReports}
          onOpenHealth={onOpenHealth} onOpenLogs={onOpenLogs} onOpenSettings={onOpenSettings} />
        <View className="flex-1 p-4">
        <View className="flex-row flex-wrap items-center justify-end gap-4">
          <ViewToggle value={viewState.view} onChange={view => setViewState({ ...viewState, view })} />
          <CatalogueDisplayOptions state={viewState} onChange={changeViewState} products={products} quickFilterCount={quickFilters.length} />
        </View>
        <Text>{statusLine}</Text>
        {message ? <Text>{message}</Text> : null}
        {viewState.view === 'grid' ? <ProductGrid
          items={items}
          numColumns={numColumns}
          renderItem={doc => <ProductTile doc={doc} fields={viewState.tileFields} tax={tax} inCart={inCartCounts?.get(connector.traits.product.getId(doc)) ?? 0} onPress={onSelect ? () => onSelect(doc) : undefined} />}
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
      </View>
    </ConnectorProvider>
  );
}
