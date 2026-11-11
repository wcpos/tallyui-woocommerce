import { useMemo, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Path } from 'react-native-svg';
import { ConnectorProvider } from '@tallyui/core';
import type { TallyConnector } from '@tallyui/core';
import { Button, createSvgIcon, defaultProductColumns, IconButton, ProductGrid, ProductTable, SearchInput, Text } from '@tallyui/components';
import type { ProductTableColumn } from '@tallyui/components';
import { productSortValue, resolveGridColumns, searchProducts, sortProducts } from '@tallyui/pos';
import type { ProductSort } from '@tallyui/pos';
import { useCatalogueView } from '../lib/catalogue/catalogue-view-state';
import type { AppCatalogueViewState } from '../lib/catalogue/catalogue-view-state';
import { catalogueFilterBaseline, isQuickFilterActive, matchesCatalogueFilters, quickFilterToQueryPatch, rebaseStockStatus, useQuickFilters } from '../lib/catalogue/quick-filters';
import type { CatalogueFilters, QuickFilter } from '../lib/catalogue/quick-filters';
import type { TileTax } from '../lib/catalogue/tile-words';
import { useWedgeScanner } from '../lib/scan/use-wedge-scanner';
import { categoriesLabel, categoryTerms, filtersAtBaseline, productsInCategory, productsLabel } from '../lib/catalogue/browse-terms';
import { BrowseCrumb, BrowseRootGrid, BrowseRootTable } from './browse-terms-view';
import type { BrowsePlace } from './browse-terms-view';
import { CatalogueDisplayOptions, CatalogueSettingsButton } from './catalogue-display-options';
import { CatalogueFilterChips } from './catalogue-filter-chips';
import { DrawerSheet } from './drawer-content';
import { FilterBarDialog } from './filter-bar-dialog';
import { InCartBadge } from './in-cart-badge';
import { ProductTile } from './product-tile';
import { QuickFilterBar } from './quick-filter-bar';
import { RegisterBarShell } from './register-bar-shell';
import { ViewModeToggle } from './view-mode-toggle';

const SyncIcon = createSvgIcon('SyncIcon', () => <><Path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><Path d="M21 3v5h-5" />
  <Path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><Path d="M8 16H3v5" /></>);

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
  onOpenSettings?(): void;
  viewState?: AppCatalogueViewState;
  onViewStateChange?(next: AppCatalogueViewState): void;
  /** The till's tax, for the tiles' Tax field; without it the field shows nothing. */
  tax?: TileTax;
  /** In-cart quantity by product id (SaleScreen's lines); without it no badge shows. */
  inCartCounts?: ReadonlyMap<string, number>;
  /** Re-runs the product sync for the footer's Sync button (v2 `sync-button.tsx`); without it no button shows. */
  onSync?(): Promise<void>;
}

export function CatalogueView({
  connector, currency, products, storeName, cashierName, cashierControl, hideOfflineBadge, status, notice, onSignOut, onOpenOrders, onOpenCustomers, onOpenReports, onOpenHealth, onOpenSettings, onSelect, onScan, message,
  viewState: controlledViewState, onViewStateChange,
  tax, inCartCounts, onSync,
}: CatalogueViewProps): JSX.Element {
  const [term, setTerm] = useState('');
  const [quickFilters, setQuickFilters] = useQuickFilters();
  const [sortOverride, setSortOverride] = useState<ProductSort | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const baseline = useMemo(() => catalogueFilterBaseline(viewState.showOutOfStock), [viewState.showOutOfStock]);
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
  // Browse by Categories, flat. v2 keeps a path of levels projected into the query (use-browse-path.ts,
  // browse-stage.tsx); with no hierarchy here one open place is enough: null is the root. The place
  // drops when Browse by changes (React's "previous render" pattern, so a change from anywhere drops it)
  // and when the active quick filter is pressed; a search, a chip or Clear filters stay inside it.
  const [place, setPlace] = useState<BrowsePlace | null>(null);
  const [browsedBy, setBrowsedBy] = useState(viewState.browseBy);
  if (browsedBy !== viewState.browseBy) { setBrowsedBy(viewState.browseBy); setPlace(null); }
  const browsing = viewState.browseBy === 'categories';
  const level = browsing ? place : null;
  // The terms count what the baseline lets through: with out-of-stock hidden, only in-stock products.
  const baselineProducts = useMemo(() => products.filter(doc => matchesCatalogueFilters(doc, baseline)), [products, baseline]);
  const terms = useMemo(() => categoryTerms(baselineProducts), [baselineProducts]);
  const levelProducts = useMemo(() => level?.kind === 'term' ? productsInCategory(products, level.id) : products, [products, level]);
  const items = useMemo(() => {
    const matching = levelProducts.filter(doc => matchesCatalogueFilters(doc, filters));
    const searched = searching ? searchProducts(matching, term, connector.traits.product) : matching;
    return sortProducts([...searched], sort, (doc, field) => productSortValue(doc, field, connector.traits.product, { currency }));
  }, [levelProducts, filters, term, searching, connector.traits.product, currency, sort]);
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
      setPlace(null);
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
  // v2's PageBar: the search fills the row, the view toggle and Product settings sit beside it, the chips below.
  const searchSlot = <View className="gap-2">
    <View className="flex-row items-center gap-2">
      <SearchInput className="flex-1" value={term} onChangeText={setTerm} placeholder="Search products"
        onSubmitEditing={() => { const code = term.trim(); if (code && onScan) scan(code); }} />
      <ViewModeToggle view={viewState.view} onChange={view => setViewState({ ...viewState, view })} />
      <CatalogueSettingsButton onPress={() => setSettingsOpen(true)} />
    </View>
    <View className="flex-row flex-wrap items-center gap-2">
      <CatalogueFilterChips products={products} filters={filters} onChange={setFilters} />
      <QuickFilterBar quickFilters={quickFilters} isActive={isActive} onPress={pressQuickFilter} />
      <FilterBarDialog quickFilters={quickFilters} onChange={changeQuickFilters} products={products} connector={connector} currency={currency} baselineSort={viewState.sort} />
    </View>
  </View>;
  const emptyState = <Text>{searching || products.length > 0 ? 'No products match' : 'No products yet'}</Text>;
  const syncing = status === 'syncing' || status === 'starting';
  // The term set shows at the root, until a search, a chip or a quick filter displaces it with the products they match.
  const atRoot = browsing && level === null && !searching && filtersAtBaseline(filters, baseline) && !quickFilters.some(isActive);
  // v2's footer count (`products/footer.tsx`): shown against total, after the sync state and any notice. At the
  // root it is v2's root tally (browse-root-footer.tsx); in a level, the level's products are the total.
  const shown = items.length, total = levelProducts.length;
  const countLabel = status === 'error' ? 'Sync failed' : notice ? notice.message ?? notice.code
    : syncing ? 'Syncing products…' : atRoot ? `${categoriesLabel(terms.length)} · ${productsLabel(baselineProducts.length)}`
    : shown < total ? `Showing ${shown.toLocaleString()} of ${total.toLocaleString()}`
    : total === 1 ? '1 product' : `${total.toLocaleString()} products`;
  const crumb = level === null ? undefined : <BrowseCrumb place={level} onRoot={() => setPlace(null)} />;
  const [syncPending, setSyncPending] = useState(false);
  function sync() {
    if (!onSync || syncing || syncPending) return;
    setSyncPending(true);
    // A failed sync reports itself through the replication's notice and status.
    onSync().catch(() => {}).finally(() => setSyncPending(false));
  }

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
          onOpenHealth={onOpenHealth} onOpenSettings={onOpenSettings} />
        <View className="flex-1 p-4">
        <CatalogueDisplayOptions state={viewState} onChange={changeViewState} products={products} quickFilterCount={quickFilters.length}
          open={settingsOpen} onOpenChange={setSettingsOpen} />
        {message ? <Text>{message}</Text> : null}
        {atRoot ? viewState.view === 'grid'
          ? <BrowseRootGrid terms={terms} numColumns={numColumns} searchSlot={searchSlot} onOpen={setPlace} />
          : <BrowseRootTable terms={terms} searchSlot={searchSlot} onOpen={setPlace} />
        : viewState.view === 'grid' ? <ProductGrid
          items={items}
          numColumns={numColumns}
          renderItem={doc => <ProductTile doc={doc} fields={viewState.tileFields} tax={tax} inCart={inCartCounts?.get(connector.traits.product.getId(doc)) ?? 0} onPress={onSelect ? () => onSelect(doc) : undefined} />}
          searchSlot={searchSlot}
          filterSlot={crumb}
          emptyState={emptyState}
        /> : <ProductTable
          items={items}
          sortItems={false}
          columns={columns}
          sort={sort}
          onSortChange={next => { setSortOverride(null); setViewState({ ...viewState, sort: next }); }}
          onSelect={onSelect}
          searchSlot={searchSlot}
          filterSlot={crumb}
          emptyState={emptyState}
        />}
        <View testID="data-table-caption-row" className="flex-row items-center gap-2 pt-2">
          <View className="flex-1" />
          <Text testID="data-table-count" className="text-sm text-muted-foreground">{countLabel}</Text>
          {onSync ? <IconButton testID="catalogue-sync" accessibilityRole="button" accessibilityLabel="Sync" variant="ghost" size="sm"
            disabled={syncing || syncPending} onPress={sync}><SyncIcon size={16} /></IconButton> : null}
        </View>
        </View>
      </View>
    </ConnectorProvider>
  );
}
