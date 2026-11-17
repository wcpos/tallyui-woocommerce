import { roundMicrosToMinor, type DayRange, type PosOrder } from '@tallyui/pos';
import { rangeBounds } from './sales-room';

export type ProductFigure = { key: string; productId: string; name: string; quantity: number; amountMinor: number };

/** A line's amount with its tax: an inclusive line's net already holds it; an exclusive line adds its rounded tax. */
export function lineGrossMinor(order: PosOrder, line: PosOrder['lines'][number]): number {
  const inclusive = line.taxInclusive ?? order.pricesIncludeTax;
  return inclusive ? line.netMinor : line.netMinor + roundMicrosToMinor(
    line.taxLines.reduce((sum, tax) => sum + BigInt(tax.taxMicros), BigInt(0)),
    order.taxRounding && 'mode' in order.taxRounding ? order.taxRounding.mode : undefined);
}

/** v2 reports/cards/aggregate.ts topProducts: tax-inclusive amounts and units; productId is kept for the Categories card. */
export function productFigures(orders: readonly PosOrder[], options: { currency: string; range: DayRange }): ProductFigure[] {
  const { startIso, endIso } = rangeBounds(options.range);
  const rows = new Map<string, ProductFigure>();
  for (const order of orders) {
    if (order.currency !== options.currency || order.createdAt < startIso || order.createdAt >= endIso) continue;
    for (const line of order.lines) {
      const key = line.variantId || line.productId || line.name || '';
      let row = rows.get(key);
      if (!row) {
        row = { key, productId: line.productId, name: line.name || '', quantity: 0, amountMinor: 0 };
        rows.set(key, row);
      }
      row.quantity += line.quantity;
      row.amountMinor += lineGrossMinor(order, line);
    }
  }
  return [...rows.values()].sort((a, b) => b.amountMinor - a.amountMinor || a.name.localeCompare(b.name));
}
