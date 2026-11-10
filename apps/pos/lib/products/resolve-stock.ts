// v2's stock rule (WCPOS monorepo `packages/core/src/screens/main/components/product/resolve-stock.ts`, `resolveStock`)
// and its labels (`hooks/use-stock-status-label.ts`, the English strings of core.json).
// Deviation: the connector stores no `backorders` field and v2 reads a missing one as 'no', so a managed product
// at zero or below is always out of stock here, never on backorder.

export type StockState = 'instock' | 'outofstock' | 'onbackorder';

export interface StockInput {
  manage_stock?: boolean | 'parent';
  stock_quantity?: number | null;
  stock_status?: string;
}

/** A self-managed product with a finite quantity: the quantity decides; otherwise `stock_status` governs. */
export function resolveStock({ manage_stock: manageStock, stock_quantity: quantity, stock_status: status }: StockInput): StockState {
  if (manageStock === true && typeof quantity === 'number' && Number.isFinite(quantity)) {
    return quantity > 0 ? 'instock' : 'outofstock';
  }
  if (status === 'outofstock') return 'outofstock';
  if (status === 'onbackorder') return 'onbackorder';
  return 'instock';
}

export const STOCK_LABEL: Record<StockState, string> = {
  instock: 'In Stock',
  outofstock: 'Out of Stock',
  onbackorder: 'On Backorder',
};
