import type { ProductSort } from '@tallyui/pos';
import type { BrowsePlace } from '../../components/browse-terms-view';
import { quickFilterToQueryPatch, rebaseStockStatus } from './quick-filters';
import type { CatalogueFilters, QuickFilter } from './quick-filters';

/** What the catalogue shows: the search, the filters, a sort that overrides the settings' sort, and the open browse place. */
export interface CatalogueQuery {
  term: string;
  filters: CatalogueFilters;
  sortOverride: ProductSort | null;
  place: BrowsePlace | null;
}

export type CatalogueQueryAction =
  | { type: 'search'; term: string }
  | { type: 'filter'; filters: CatalogueFilters }
  | { type: 'open'; place: BrowsePlace | null }
  | { type: 'stockSettingChanged'; showOutOfStock: boolean }
  | { type: 'sortSettingChanged' }
  | { type: 'browseByChanged' }
  | { type: 'applyQuickFilter'; quickFilter: QuickFilter; baseline: CatalogueFilters }
  /** Pressing the active quick filter restores the baseline and returns to the browse root, as v2. */
  | { type: 'clearQuickFilter'; baseline: CatalogueFilters }
  /** The applied quick filter was deleted or changed in the filter bar, so the catalogue resets to the baseline but stays in its browse place. */
  | { type: 'appliedQuickFilterGone'; baseline: CatalogueFilters };

export function initialCatalogueQuery(baseline: CatalogueFilters): CatalogueQuery {
  return { term: '', filters: baseline, sortOverride: null, place: null };
}

export function catalogueQuery(state: CatalogueQuery, action: CatalogueQueryAction): CatalogueQuery {
  switch (action.type) {
    case 'search': return { ...state, term: action.term };
    case 'filter': return { ...state, filters: action.filters };
    case 'open': return { ...state, place: action.place };
    case 'stockSettingChanged': return { ...state, filters: rebaseStockStatus(state.filters, action.showOutOfStock) };
    case 'sortSettingChanged': return { ...state, sortOverride: null };
    case 'browseByChanged': return { ...state, place: null };
    case 'applyQuickFilter': {
      const patch = quickFilterToQueryPatch(action.quickFilter);
      return { ...state, term: patch.search, filters: { ...action.baseline, ...patch.filters }, sortOverride: action.quickFilter.sort ?? null };
    }
    case 'clearQuickFilter': return initialCatalogueQuery(action.baseline);
    case 'appliedQuickFilterGone': return { ...state, term: '', filters: action.baseline, sortOverride: null };
  }
}
