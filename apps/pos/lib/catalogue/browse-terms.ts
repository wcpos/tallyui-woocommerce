// v2's Browse by Categories, flat: the term set comes from the categories the synced products carry
// (WCPOS monorepo `packages/core/src/screens/main/pos/products/browse/`). The connector has no
// product-categories collection, so there is no parent, image, menu_order or display type here.
// A term's tint is tile-words' tintOf of its id.
import type { CatalogueFilters } from './quick-filters';

export interface BrowseTerm { id: number; name: string; count: number }

interface CategoryRef { id: number; name: string }

function categoriesOf(doc: any): CategoryRef[] {
  return Array.isArray(doc?.categories) ? doc.categories : [];
}

// v2's term-tree.ts `byName`: a flat taxonomy is ordered by name alone.
const byName = (a: BrowseTerm, b: BrowseTerm) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/**
 * One term per distinct category id the products carry, counted over those products and ordered by
 * name. A term only exists because a product carries it, so an empty term never appears (v2 hides
 * empty terms too).
 */
export function categoryTerms(products: readonly any[]): BrowseTerm[] {
  const terms = new Map<number, BrowseTerm>();
  for (const doc of products) {
    // A product that lists a category twice counts once.
    const seen = new Set<number>();
    for (const category of categoriesOf(doc)) {
      if (seen.has(category.id)) continue;
      seen.add(category.id);
      const term = terms.get(category.id);
      if (term) term.count += 1;
      else terms.set(category.id, { id: category.id, name: category.name, count: 1 });
    }
  }
  return [...terms.values()].filter(term => term.count > 0).sort(byName);
}

/** The products whose categories include the id. */
export function productsInCategory<T>(products: readonly T[], id: number): T[] {
  return products.filter(doc => categoriesOf(doc).some(category => category.id === id));
}

/** `1 product` / `2 products`: v2's `{count} product` and `{count} products`. */
export function countLabel(n: number, one: string, other: string): string {
  return `${n.toLocaleString()} ${n === 1 ? one : other}`;
}

export const categoriesLabel = (n: number) => countLabel(n, 'category', 'categories');
export const productsLabel = (n: number) => countLabel(n, 'product', 'products');

const isEmptyFilter = (value: unknown) => value === undefined || (Array.isArray(value) && value.length === 0);

/**
 * v2's use-browse-path.ts `filtersAtBaseline`: every key, live or baseline, equals its baseline value
 * or is empty on both sides. An id list compares as a set.
 */
export function filtersAtBaseline(filters: CatalogueFilters, baseline: CatalogueFilters): boolean {
  const live = filters as Record<string, unknown>, initial = baseline as Record<string, unknown>;
  return [...new Set([...Object.keys(live), ...Object.keys(initial)])].every(key => {
    const value = live[key], expected = initial[key];
    if (isEmptyFilter(value) && isEmptyFilter(expected)) return true;
    if (Array.isArray(value) && Array.isArray(expected)) return value.length === expected.length && expected.every(id => value.includes(id));
    return JSON.stringify(value) === JSON.stringify(expected);
  });
}
