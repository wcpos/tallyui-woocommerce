import { formatMoney, minorUnitDigits, moneyToMajor } from '@tallyui/core';
import type { Money, StockLevel } from '@tallyui/core';
import { roundMicrosToMinor, taxMicros } from '@tallyui/pos';
import type { LineItem, TaxContext } from '@tallyui/pos';

/** What a tile needs from the till's tax settings; SaleScreen passes useTax()'s value. */
export type TileTax = Pick<TaxContext, 'getTaxRatePpm' | 'pricesIncludeTax'>;
export type TileStockMark = { kind: 'count'; value: number; label: string } | { kind: 'backorder'; label: string };

// v2's tile-words.tsx money words, with ProductPrice's fallback.
export function formatTileMoney(money: Money): string {
  return formatMoney(money) ?? `$${moneyToMajor(money).toFixed(minorUnitDigits(money.currency))}`;
}

// v2's tile-words.tsx never marks a variable parent sold out.
export function isSoldOut(stock: StockLevel, isVariable: boolean): boolean {
  return !isVariable && stock.status === 'out_of_stock';
}

// v2's tile-words.tsx shows a remaining count or Backorder for simple products.
export function tileStockMark(stock: StockLevel, isVariable: boolean): TileStockMark | null {
  if (isVariable) return null;
  const { quantity } = stock;
  if (typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0) {
    return { kind: 'count', value: quantity, label: `${quantity} left` };
  }
  return stock.status === 'backorder' ? { kind: 'backorder', label: 'Backorder' } : null;
}

// v2's tile-words.tsx tax words use the product's tax class rate.
export function tileTaxLine(price: Money, taxStatus: 'taxable' | 'none' | undefined, taxClass: string | undefined, tax: TileTax): string | null {
  if (taxStatus !== 'taxable') return null;
  const ratePpm = tax.getTaxRatePpm(taxClass);
  if (!(ratePpm > 0)) return null;
  const amount = roundMicrosToMinor(taxMicros(price.amount, ratePpm, tax.pricesIncludeTax));
  return `${tax.pricesIncludeTax ? 'incl.' : 'excl.'} ${formatTileMoney({ amount, currency: price.currency })} tax`;
}

// v2's useProductCount sums quantities under the product's parent id.
export function inCartCounts(lines: readonly Pick<LineItem, 'productId' | 'quantity' | 'custom'>[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of lines) {
    if (line.custom) continue;
    counts.set(line.productId, (counts.get(line.productId) ?? 0) + line.quantity);
  }
  return counts;
}

// v2's poster-tile/tint-of.ts: a number is its value modulo six; a string is the sum of its
// UTF-16 code units modulo six, so the same key always gets the same tint.
export function tintOf(key: number | string): number {
  let n = 0;
  if (typeof key === 'number') n = Number.isFinite(key) ? Math.trunc(key) : 0;
  else for (let i = 0; i < key.length; i += 1) n += key.charCodeAt(i);
  return ((n % 6) + 6) % 6;
}

// v2 keys a picture-less tile by its first category id (a number in WooCommerce), else the product's name.
export function tileTint(categories: readonly { id: string }[], name: string): number {
  const first = categories[0]?.id;
  if (first === undefined) return tintOf(name);
  return tintOf(/^\d+$/.test(first) ? Number(first) : first);
}

// v2's pos_products.n_options copy ("{count} option" / "{count} options").
export function optionsLabel(count: number): string | null {
  if (count < 1) return null;
  return count === 1 ? '1 option' : `${count} options`;
}
