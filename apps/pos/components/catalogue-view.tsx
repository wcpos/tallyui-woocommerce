import { useMemo, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Path } from 'react-native-svg';
import { ConnectorProvider } from '@tallyui/core';
import type { TallyConnector } from '@tallyui/core';
import { Button, createSvgIcon, defaultProductColumns, IconButton, ProductGrid, ProductTable, SearchInput, Text } from '@tallyui/components';
import type { ProductTableColumn } from '@tallyui/components';
import { catalogueEntries, productSortValue, resolveGridColumns, searchProducts, sortProducts } from '@tallyui/pos';
import type { CatalogueEntry, ProductSort } from '@tallyui/pos';
import { useCatalogueView } from '../lib/catalogue/catalogue-view-state';
import type { AppCatalogueViewState } from '../lib/catalogue/catalogue-view-state';
import { catalogueFilterBaseline, isQuickFilterActive, matchesCatalogueFilters, quickFilterToQueryPatch, rebaseStockStatus, useQuickFilters } from '../lib/catalogue/quick-filters';
import type { CatalogueFilters, QuickFilter } from '../lib/catalogue/quick-filters';
import { optionsLabel } from '../lib/catalogue/tile-words';
import type { TileTax } from '../lib/catalogue/tile-words';
import { needsAnyPick, variantMatchesStock } from '../lib/catalogue/variation-match';
import { useIsWide } from '../lib/layout/wide';
import { useWedgeScanner } from '../lib/scan/use-wedge-scanner';
import { categoriesLabel, categoryTerms, filtersAtBaseline, productsInCategory, productsLabel } from '../lib/catalogue/browse-terms';
import { BrowseCrumb, BrowseRootGrid, BrowseRootTable, ParentTermTile } from './browse-terms-view';
import type { BrowsePlace } from './browse-terms-view';
import { CatalogueDisplayOptions, CatalogueSettingsButton } from './catalogue-display-options';
import { CatalogueFilterChips } from './catalogue-filter-chips';
import { DrawerSheet } from './drawer-content';
import { FilterBarDialog } from './filter-bar-dialog';
import { InCartBadge } from './in-cart-badge';
import { ProductTile } from './product-tile';
import { QuickFilterBar } from './quick-filter-bar';
import { RegisterBarShell } from './register-bar-shell';
import { ParentTile, VariationTile } from './variation-tile';
import { ViewModeToggle } from './view-mode-toggle';

const SyncIcon = createSvgIcon('SyncIcon', () => <><Path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><Path d="M21 3v5h-5" />
  <Path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><Path d="M8 16H3v5" /></>);

// Slot 0 of a level's grid, the opened place's own tile: an id no product carries, for the grid's key.
const PARENT_SLOT_ID = 'browse-parent';

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
  /** Adds one variation from the grid's drill-in (v2's useAddVariation); without it a variable tile calls onSelect. */
  onAddEntry?(entry: CatalogueEntry<any>): void;
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
  /** SaleScreen draws the PosBar itself, over the cart column (v2 cart/index.tsx RegisterBar) or over both phone
   *  panes, so the catalogue leaves its own out and starts with its search row. */
  hideBar?: boolean;
}

export type PosBarProps = Pick<CatalogueViewProps, 'storeName' | 'cashierName' | 'cashierControl' | 'onSignOut'
  | 'onOpenOrders' | 'onOpenCustomers' | 'onOpenReports' | 'onOpenHealth' | 'onOpenSettings'>;

/** The till's top bar and the drawer its menu button opens: the bar owns the drawer's open state. */
export function PosBar({ storeName, cashierName, cashierControl, onSignOut,
  onOpenOrders, onOpenCustomers, onOpenReports, onOpenHealth, onOpenSettings }: PosBarProps): JSX.Element {
  const areas = { onOpenOrders, onOpenCustomers, onOpenReports, onOpenHealth, onOpenSettings };
  const [drawerOpen, setDrawerOpen] = useState(false);
  return <>
    <RegisterBarShell storeName={storeName} onOpenMenu={() => setDrawerOpen(true)}
      avatar={<>
        {cashierControl ?? <Text>{`Cashier: ${cashierName}`}</Text>}
        {cashierControl == null && <Button onPress={onSignOut}><Text>Sign out</Text></Button>}
      </>} />
    <DrawerSheet open={drawerOpen} onOpenChange={setDrawerOpen} {...areas} />
  </>;
}

export function CatalogueView({
  connector, currency, products, storeName, cashierName, cashierControl, status, notice, onSignOut, onOpenOrders, onOpenCustomers, onOpenReports, onOpenHealth, onOpenSettings, onSelect, onAddEntry, onScan, message,
  viewState: controlledViewState, onViewStateChange,
  tax, inCartCounts, onSync, hideBar,
}: CatalogueViewProps): JSX.Element {
  const [term, setTerm] = useState('');
  const [quickFilters, setQuickFilters] = useQuickFilters();
  const [sortOverride, setSortOverride] = useState<ProductSort | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterBarOpen, setFilterBarOpen] = useState(false);
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
  // As v2 at every width: the Tile Size setting is the column count, for category and product tiles alike
  // (v2 tiles/tile-grid.tsx `useGridColumns` reads `gridColumns` with no width rule; default 4, initial-settings.json).
  const numColumns = resolveGridColumns(viewState.gridColumns, width);
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
  // v2's DrillIn in the dealt grid (drill-in.tsx, variations-grid.tsx): a tapped variable product opens its
  // variations in place of the products, under a crumb that ends in its name. It holds only while the search,
  // the filters, the place and the view stay as they were when it opened (React's "previous render" pattern).
  const traits = connector.traits.product;
  const [drill, setDrill] = useState<{ id: string; from: readonly unknown[] } | null>(null);
  const drillFrom = [term, filters, place, viewState.browseBy, viewState.view];
  const drillHolds = drill !== null && drill.from.every((value, index) => value === drillFrom[index]);
  if (drill !== null && !drillHolds) setDrill(null);
  const drilled = drillHolds ? products.find(doc => traits.getId(doc) === drill.id) : undefined;
  // v2 hands the pane the stock filter: with In Stock on, an out-of-stock variation is left out.
  const drillEntries = useMemo(() => drilled
    ? catalogueEntries([drilled], traits, { currency }).filter(entry => variantMatchesStock(entry.variant, filters.stock_status))
    : [], [drilled, traits, currency, filters.stock_status]);
  // A grid tap drills in when there are variations to choose between and none of them waits on an "Any" pick;
  // anything else, and every table row, keeps onSelect's path (VariantChooser).
  function tap(doc: any) {
    try {
      const entries = onAddEntry && viewState.view === 'grid' && traits.hasVariants(doc) ? catalogueEntries([doc], traits, { currency }) : [];
      if (entries.length > 1 && !needsAnyPick(traits.getVariantOptions?.(doc) ?? [], entries.map(entry => entry.variant))) {
        setDrill({ id: traits.getId(doc), from: drillFrom });
        return;
      }
    } catch { /* onSelect reports what it cannot sell */ }
    onSelect?.(doc);
  }
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
  // In a window v2's bar row sits the page gutter under the column's top (page-bar/index.tsx:86 `ground.pt`) and
  // its ChipRow pads the gutter all round (chip-row/index.tsx:29 `useGround().p`, ground.ts:46-58): 12 px over the
  // search, between it and the chips, and under the chips. TallyUI's slot pads 8 above and below (`py-2`), so this
  // adds 4 to each. A phone keeps its own spacing (the phone head below).
  const wide = useIsWide();
  const searchSlot = <View testID="catalogue-search-slot" className={wide ? 'gap-3 pt-1 pb-1' : 'gap-2'}>
    <View className="flex-row items-center gap-2">
      {/* h-11: v2's control height `h-ctl`, 44 px (monorepo apps/main/global.css:40), over TallyUI's 40. */}
      <SearchInput testID="catalogue-search" className="h-11 flex-1" value={term} onChangeText={setTerm} placeholder="Search products"
        onSubmitEditing={() => { const code = term.trim(); if (code && onScan) scan(code); }} />
      <ViewModeToggle view={viewState.view} onChange={view => setViewState({ ...viewState, view })} />
      <CatalogueSettingsButton onPress={() => setSettingsOpen(true)} />
    </View>
    {/* v2's ChipRow: one horizontal scroller at every width, chips only; the filter bar opens from Product settings. */}
    <ScrollView testID="catalogue-chip-row" horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      contentContainerClassName="items-center gap-2">
      {/* v2 folds the place's own pill while a browse level is open (filter-bar.tsx:505, `place={browsePlace}` from
          index.tsx:599): the Categories source's field, for a category and All products alike, and for a product drilled
          inside the level. A product drilled from no level only dims it (filter-bar.tsx:508). */}
      <CatalogueFilterChips products={products} filters={filters} onChange={setFilters} dimmed={drilled !== undefined}
        placeField={level === null ? undefined : 'categories'} />
      <QuickFilterBar quickFilters={quickFilters} isActive={isActive} onPress={pressQuickFilter} dimmed={drilled !== undefined} />
    </ScrollView>
    <FilterBarDialog open={filterBarOpen} onOpenChange={setFilterBarOpen} quickFilters={quickFilters} onChange={changeQuickFilters}
      products={products} connector={connector} currency={currency} baselineSort={viewState.sort} />
  </View>;
  const emptyState = <Text>{searching || products.length > 0 ? 'No products match' : 'No products yet'}</Text>;
  const syncing = status === 'syncing' || status === 'starting';
  // The term set shows at the root, until a search, a chip or a quick filter displaces it with the products they match.
  const atRoot = browsing && level === null && !searching && filtersAtBaseline(filters, baseline) && !quickFilters.some(isActive);
  // v2's footer count (`products/footer.tsx`): shown against total, after the sync state and any notice. At the
  // root it is v2's root tally (browse-root-footer.tsx); in a level, the level's products are the total.
  const shown = items.length, total = levelProducts.length;
  const countLabel = status === 'error' ? 'Sync failed' : notice ? notice.message ?? notice.code
    : syncing ? 'Syncing products…' : drilled ? optionsLabel(drillEntries.length) ?? '0 options' : atRoot ? `${categoriesLabel(terms.length)} · ${productsLabel(baselineProducts.length)}`
    : shown < total ? `Showing ${shown.toLocaleString()} of ${total.toLocaleString()}`
    : total === 1 ? '1 product' : `${total.toLocaleString()} products`;
  // One level back from a level: the crumb's previous step and the parent tile's. The browse is flat, so that is the root.
  const backToRoot = () => setPlace(null);
  const crumb = drilled ? <BrowseCrumb place={level} onRoot={() => { setDrill(null); setPlace(null); }}
      product={{ name: traits.getName(drilled), onBack: () => setDrill(null) }} />
    : level === null ? undefined : <BrowseCrumb place={level} onRoot={backToRoot} />;
  // v2's phone ground (packages/components/src/lib/ground.ts:60-72, `PHONE`): 16 from the screen's edge for the bar,
  // the chip row and the crumb (page-bar/index.tsx:86 `pl-4`, chip-row/index.tsx:29) and the tiles (data-table/
  // surface.tsx:49-55 `TileGround`). TallyUI's slots inset the search 12 and its ProductGrid the tiles 8 (FlatList
  // `p-1` plus the cell's `p-1`), 4 apart, so on a phone the search and the crumb stand above the grid in the app's
  // own `px-4` head and the grid takes `px-2` (8 + 8). A window keeps them in TallyUI's slots, unchanged.
  const slots = (filterSlot?: ReactNode) => wide ? { searchSlot, filterSlot } : {};
  const gridGutter = wide ? '' : 'px-2';
  const productTile = (doc: any) => <ProductTile doc={doc} fields={viewState.tileFields} tax={tax}
    inCart={inCartCounts?.get(traits.getId(doc)) ?? 0} onPress={onSelect || onAddEntry ? () => tap(doc) : undefined} />;
  // As ProductGrid counts it: a level is empty when nothing in it is sellable.
  const levelEmpty = !items.some(doc => traits.isSellable(doc));
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
        {hideBar ? null : <PosBar storeName={storeName} cashierName={cashierName} cashierControl={cashierControl}
          onSignOut={onSignOut} onOpenOrders={onOpenOrders} onOpenCustomers={onOpenCustomers}
          onOpenReports={onOpenReports} onOpenHealth={onOpenHealth} onOpenSettings={onOpenSettings} />}
        {/* No inset of its own: the search row, the chips and the grid sit in TallyUI's px-3, v2's 12 px page gutter
            (monorepo apps/main/global.css:30 `--spacing-gutter: calc(var(--spacing) * 3)`; pos/products/index.tsx:551). */}
        <View testID="pos-products-column" className="flex-1">
        <CatalogueDisplayOptions state={viewState} onChange={changeViewState} products={products} quickFilterCount={quickFilters.length}
          open={settingsOpen} onOpenChange={setSettingsOpen} onCustomiseFilterBar={() => setFilterBarOpen(true)} />
        {message ? <Text>{message}</Text> : null}
        {/* TallyUI's slot spacing (`py-2` over the search, `pb-2` under the crumb) at v2's phone gutter. */}
        {wide ? null : <View testID="catalogue-phone-head" className="gap-2 px-4 py-2">{searchSlot}{crumb}</View>}
        {drilled ? <ProductGrid
          className={gridGutter}
          items={[drilled, ...drillEntries.map(entry => ({ id: `variation-${entry.variant.id}`, entry }))]}
          numColumns={numColumns}
          renderItem={(item, index) => index === 0
            ? <ParentTile doc={drilled} fields={viewState.tileFields} tax={tax} onBack={() => setDrill(null)} />
            : <VariationTile entry={item.entry} onPress={() => onAddEntry?.(item.entry)} />}
          {...slots(crumb)}
        />
        : atRoot ? viewState.view === 'grid'
          ? <BrowseRootGrid terms={terms} numColumns={numColumns} {...slots()} onOpen={setPlace} />
          : <BrowseRootTable terms={terms} {...slots()} onOpen={setPlace} />
        : viewState.view === 'grid' ? level === null ? <ProductGrid
          testID="catalogue-grid"
          className={gridGutter}
          items={items}
          numColumns={numColumns}
          renderItem={productTile}
          {...slots(crumb)}
          emptyState={emptyState}
        />
        // v2's TermLevelGrid (term-grid.tsx): the opened place's own tile in slot 0 is the way back, then its
        // products. A level with no products keeps slot 0 and shows the empty state under it.
        : <View className="flex-1">
          <ProductGrid
            testID="browse-level"
            className={`${levelEmpty ? 'flex-none' : ''} ${gridGutter}`.trim()}
            items={[{ id: PARENT_SLOT_ID }, ...items]}
            numColumns={numColumns}
            renderItem={(doc, index) => index === 0
              ? <ParentTermTile place={level} count={level.kind === 'term' ? terms.find(term => term.id === level.id)?.count : undefined} onBack={backToRoot} />
              : productTile(doc)}
            {...slots(crumb)}
          />
          {levelEmpty && <View testID="browse-level-empty" className="items-center justify-center p-4">{emptyState}</View>}
        </View> : <ProductTable
          items={items}
          sortItems={false}
          columns={columns}
          sort={sort}
          onSortChange={next => { setSortOverride(null); setViewState({ ...viewState, sort: next }); }}
          onSelect={onSelect}
          {...slots(crumb)}
          emptyState={emptyState}
        />}
        <View testID="data-table-caption-row" className="flex-row items-center gap-2 px-3 py-2">
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
