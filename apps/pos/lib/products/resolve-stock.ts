// v2's stock rule (WCPOS monorepo `packages/core/src/screens/main/components/product/resolve-stock.ts`, `resolveStock`)
// and its labels (`hooks/use-stock-status-label.ts`, the English strings of core.json).
// Backorders follow v2's `resolve-stock.ts:20-58`: only 'yes' and 'notify' allow selling past zero.

export type StockState = 'instock' | 'outofstock' | 'onbackorder';

export interface StockInput {
  manage_stock?: boolean | 'parent';
  stock_quantity?: number | null;
  stock_status?: string;
  backorders?: string;
}

export function backordersAllowed(backorders: string | undefined): boolean {
  return backorders === 'yes' || backorders === 'notify';
}

/** A self-managed product with a finite quantity: the quantity decides; otherwise `stock_status` governs. */
export function resolveStock({ manage_stock: manageStock, stock_quantity: quantity, stock_status: status, backorders }: StockInput): StockState {
  if (manageStock === true && typeof quantity === 'number' && Number.isFinite(quantity)) {
    return quantity > 0 ? 'instock' : backordersAllowed(backorders) ? 'onbackorder' : 'outofstock';
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
