import type { QuickFilterCondition, QuickFilterSort } from './quick-filters';

export interface QuickFilterStarter {
  id: 'category' | 'sale_in_category' | 'under_price' | 'low_stock' | 'tag';
  icon: 'category' | 'currency' | 'warehouse' | 'tag';
  title: string;
  line: string;
  conditions: readonly QuickFilterCondition[];
  sort?: QuickFilterSort;
}

// v2's starters, order and English copy (monorepo packages/core/src/screens/main/pos/products/filter-bar/quick-filter-starters.ts,
// copy from packages/core/src/contexts/translations/locales/en/core.json:1281-1294).
// Left out: best_sellers (sort total_sales) and new_arrivals (sort date_created_gmt), which
// @tallyui/pos productSortValue cannot sort by. low_stock's stock_quantity is the app's `stock` field.
export const QUICK_FILTER_STARTERS: readonly QuickFilterStarter[] = [
  { id: 'category', icon: 'category', title: 'A category', line: 'One tap straight to a category',
    conditions: [{ field: 'categories', value: [] }] },
  { id: 'sale_in_category', icon: 'currency', title: 'On sale in a category', line: 'Sale wines, sale shoes…',
    conditions: [{ field: 'categories', value: [] }, { field: 'on_sale', value: true }] },
  { id: 'under_price', icon: 'currency', title: 'Under a price', line: 'Gifts under a price, stocking fillers',
    conditions: [{ field: 'price', value: {} }] },
  { id: 'low_stock', icon: 'warehouse', title: 'Low stock', line: 'Fewest left first',
    conditions: [], sort: { field: 'stock', dir: 'asc' } },
  { id: 'tag', icon: 'tag', title: 'A tag', line: 'Gluten free, Local, Gift…',
    conditions: [{ field: 'tags', value: [] }] },
];
