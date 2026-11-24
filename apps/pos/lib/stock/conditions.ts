import type { LineItem } from '@tallyui/pos';
import { evaluateStock, existingCartQuantity, lineStockDocs } from './stock-guard';

export type UnmetStock = { lineId: string; name: string; available: number | null; fit: number; fix: 'reduce' | 'remove' };

// v2 conditions/evaluate.ts:29-68: every eligible line is judged, including unknown records.
export function unmetStock(lines: readonly LineItem[], products: readonly any[], getId: (doc: any) => string): UnmetStock[] {
  const unmet: UnmetStock[] = [];
  for (const line of lines) {
    if (line.custom || line.storeLineId !== undefined || !(line.quantity > 0)) continue;
    const docs = lineStockDocs(products, getId, line);
    if (!docs) {
      unmet.push({ lineId: line.id, name: line.name, available: null, fit: 0, fix: 'remove' });
      continue;
    }
    const existing = existingCartQuantity(lines.filter(other => other.id !== line.id), line.productId, line.variantId, docs);
    const result = evaluateStock(docs, existing, line.quantity);
    if (result.allowed) continue;
    const available = result.available;
    const counted = available !== null && available > 0;
    unmet.push({ lineId: line.id, name: line.name, available, fit: counted ? Math.max(0, Number((available - existing).toFixed(12))) : 0, fix: counted ? 'reduce' : 'remove' });
  }
  return unmet;
}

// v2 en core.json pos_cart.only_n_available and pos_products.out_of_stock.
export function unmetText(u: UnmetStock): string {
  return u.fix === 'reduce' ? `Only ${u.available} available for ${u.name}` : `${u.name} out of stock`;
}
