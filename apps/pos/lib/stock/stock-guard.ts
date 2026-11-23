import type { CatalogueEntry, LineItem } from '@tallyui/pos';
import { backordersAllowed } from '../products/resolve-stock';

// v2 pos/hooks/stock-guard.ts:5-11, with the catalogue record's id.
export type StockDoc = { id?: number | string; manage_stock?: boolean | 'parent'; stock_quantity?: number | null; stock_status?: string; backorders?: string };

// v2 pos/hooks/stock-guard-hook.ts:29-34: read the product and the selected variation.
export function entryStockDocs(entry: CatalogueEntry<any>): { product: StockDoc; variation?: StockDoc } {
  const product = entry.product;
  const variation = product.type === 'variable'
    ? product.variation_docs?.find((doc: StockDoc) => String(doc.id) === entry.variant.id) : undefined;
  return { product, variation };
}

// v2 pos/hooks/stock-guard-hook.ts:34-36: refuse when the product or required variation is not loaded.
export function lineStockDocs(products: readonly any[], getId: (doc: any) => string, line: { productId: string; variantId?: string }): { product: StockDoc; variation?: StockDoc } | undefined {
  const product = products.find(doc => getId(doc) === line.productId);
  if (!product) return undefined;
  const variation = product.type === 'variable'
    ? product.variation_docs?.find((doc: StockDoc) => String(doc.id) === line.variantId) : undefined;
  if (product.type === 'variable' && !variation) return undefined;
  return { product, variation };
}

// v2 pos/hooks/stock-guard.ts:73-97; kept store lines stand in for its reduced-stock netting.
export function existingCartQuantity(
  lines: readonly Pick<LineItem, 'productId' | 'variantId' | 'quantity' | 'custom' | 'storeLineId'>[],
  productId: string, variantId: string | undefined, docs: { product: StockDoc; variation?: StockDoc },
): number {
  const parentOwnsStock = docs.variation?.manage_stock !== true && docs.product.manage_stock === true;
  return lines.reduce((total, line) => {
    if (line.custom || line.storeLineId !== undefined || line.productId !== productId) return total;
    if (!parentOwnsStock && line.variantId !== variantId) return total;
    const quantity = Number.isFinite(line.quantity) ? Math.max(0, Number(line.quantity.toFixed(12))) : 0;
    return Number((total + quantity).toFixed(12));
  }, 0);
}

// v2 pos/hooks/stock-guard.ts:103-141: stock owner, finite quantity, backorders, then status.
export function evaluateStock(
  { product, variation }: { product: StockDoc; variation?: StockDoc }, existing: number, requested: number,
): { allowed: boolean; warning: 'backorder' | null; available: number | null } {
  const owner = variation?.manage_stock === true ? variation : product;
  const managed = owner.manage_stock === true;
  const quantity = owner.stock_quantity;
  if (managed && typeof quantity === 'number' && Number.isFinite(quantity)) {
    const exceeds = Number((existing + requested).toFixed(12)) > Number(quantity.toFixed(12));
    if (!exceeds) return { allowed: true, warning: null, available: quantity };
    const allowed = backordersAllowed(owner.backorders);
    return { allowed, warning: allowed && owner.backorders === 'notify' ? 'backorder' : null, available: quantity };
  }
  const status = managed ? owner.stock_status : variation?.stock_status ?? product.stock_status;
  return { allowed: status !== 'outofstock', warning: null, available: null };
}

// v2 pos/hooks/stock-guard-hook.ts:65-71 (en core.json pos_products.out_of_stock / pos_cart.only_n_available).
export function stockGuardToast(result: ReturnType<typeof evaluateStock>, name: string): string | null {
  if (result.allowed) return null;
  return result.available === null ? `${name} out of stock` : `Only ${result.available} available for ${name}`;
}

// v2 pos/hooks/stock-guard-hook.ts:103-108 (en core.json pos_cart.will_be_backordered).
export function backorderToast(name: string): string {
  return `${name} will be backordered`;
}

// v2 en core.json pos_cart.stock_not_loaded.
export function stockNotLoadedToast(name: string): string {
  return `Stock for ${name} hasn't loaded on this device yet. Try again in a moment.`;
}
