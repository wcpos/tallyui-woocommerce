import { useCallback, useState } from 'react';
import { normalizeCatalogueViewState } from '@tallyui/pos';
import type { CatalogueViewState } from '@tallyui/pos';

export const CATALOGUE_VIEW_KEY = 'tallywoo.catalogue_view.v1';
// WCPOS v2's products panel defaults: grid, 4 tiles a row, name ascending.
export const CATALOGUE_VIEW_DEFAULTS: CatalogueViewState = { view: 'grid', gridColumns: 4, sort: { field: 'name', dir: 'asc' }, categoryId: null };

export function loadCatalogueView(storage?: Storage): CatalogueViewState {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(CATALOGUE_VIEW_KEY);
    if (raw === null) return CATALOGUE_VIEW_DEFAULTS;
    return normalizeCatalogueViewState(JSON.parse(raw), CATALOGUE_VIEW_DEFAULTS);
  } catch { return CATALOGUE_VIEW_DEFAULTS; }
}

export function saveCatalogueView(state: CatalogueViewState, storage?: Storage): void {
  try {
    (storage ?? globalThis.localStorage).setItem(CATALOGUE_VIEW_KEY, JSON.stringify(state));
  } catch {}
}

export function useCatalogueView(): [CatalogueViewState, (next: CatalogueViewState) => void] {
  const [state, setState] = useState(() => loadCatalogueView());
  const update = useCallback((next: CatalogueViewState) => {
    saveCatalogueView(next);
    setState(next);
  }, []);
  return [state, update];
}
