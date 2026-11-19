import type { DayRange, PosOrder } from '@tallyui/pos';
import { categoriesOf } from '../catalogue/browse-terms';
import { lineGrossMinor, type ProductFigure } from './product-figures';
import { rangeBounds } from './sales-room';

export type CategoryFigure = { key: string; label: string; amountMinor: number; quantity: number };
export type CategoryFigures = { parts: CategoryFigure[]; unknownLines: number; totalLines: number };

/** v2 rolls a category up to its top-level parent; the connector has no product-categories collection (no parent),
 * so Tally keys a line by its product's first category as it stands. A connector gap. */
export function categoryFigures(orders: readonly PosOrder[], products: readonly any[],
  options: { currency: string; range: DayRange }): CategoryFigures {
  const { startIso, endIso } = rangeBounds(options.range);
  const rows = new Map<string, CategoryFigure>();
  let unknownLines = 0, totalLines = 0;
  const directory = new Map(products.map(product => [String(product.id), product]));
  for (const order of orders) {
    if (order.currency !== options.currency || order.createdAt < startIso || order.createdAt >= endIso) continue;
    for (const line of order.lines) {
      const product = directory.get(line.productId);
      const category = categoriesOf(product)[0];
      const key = !product ? 'unknown' : category ? String(category.id) : 'uncategorised';
      const label = !product ? 'Unknown product' : category ? category.name : 'Uncategorised';
      let row = rows.get(key);
      if (!row) {
        row = { key, label, amountMinor: 0, quantity: 0 };
        rows.set(key, row);
      }
      row.amountMinor += lineGrossMinor(order, line);
      row.quantity += line.quantity;
      totalLines += 1;
      if (!product) unknownLines += 1;
    }
  }
  return { parts: [...rows.values()].sort((a, b) => b.amountMinor - a.amountMinor || a.label.localeCompare(b.label)), unknownLines, totalLines };
}

const firstCategoryOf = (catalogue: readonly any[]) => {
  const directory = new Map(catalogue.map(product => [String(product.id), product]));
  return (row: ProductFigure) => categoriesOf(directory.get(row.productId))[0];
};

/** v2 panels/line-filters.ts categoryChoices: each sold product's first category, by name. Flat, as the connector
 * has no category tree (no parent chain). */
export function productCategoryChoices(products: readonly ProductFigure[], catalogue: readonly any[]) {
  const categoryOf = firstCategoryOf(catalogue);
  const choices = new Map<string, string>();
  for (const row of products) {
    const category = categoryOf(row);
    if (category?.id != null) choices.set(String(category.id), category.name || 'Unknown');
  }
  return [...choices].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

/** v2 line-filters.ts filterLines: a product stays when its first category is the chosen one. */
export function productsInCategory(products: readonly ProductFigure[], catalogue: readonly any[], categoryId: string) {
  const categoryOf = firstCategoryOf(catalogue);
  return products.filter(row => String(categoryOf(row)?.id) === categoryId);
}
