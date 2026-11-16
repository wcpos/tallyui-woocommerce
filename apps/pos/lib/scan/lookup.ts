import type { ProductTraits, TraitContext } from '@tallyui/core';
import { catalogueEntries } from '@tallyui/pos';
import type { CatalogueEntry } from '@tallyui/pos';

export type CodeLookup<Doc> =
  | { kind: 'entry'; entry: CatalogueEntry<Doc> }
  | { kind: 'product'; product: Doc }
  | { kind: 'several'; count: number }
  | { kind: 'none' };

export function lookupCode<Doc>(products: Doc[], traits: ProductTraits<Doc>, code: string, context?: TraitContext): CodeLookup<Doc> {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return { kind: 'none' };
  const entries = catalogueEntries(products, traits, context);
  for (const field of ['barcode', 'sku'] as const) {
    const matches = entries.filter(entry => entry.variant[field]?.trim().toLowerCase() === normalized);
    if (matches.length === 1) return { kind: 'entry', entry: matches[0] };
    if (matches.length > 1) return { kind: 'several', count: matches.length };
  }
  const matches = products.filter(product => traits.hasVariants(product) && (
    traits.getBarcode(product)?.trim().toLowerCase() === normalized || traits.getSku(product)?.trim().toLowerCase() === normalized
  ));
  if (matches.length === 1) return { kind: 'product', product: matches[0] };
  if (matches.length > 1) return { kind: 'several', count: matches.length };
  return { kind: 'none' };
}

/** What a scanned code means for the cart, shared by the catalogue's and checkout's scan handlers (sale-screen.tsx). */
export type ScanOutcome<Doc> =
  | { kind: 'add'; entry: CatalogueEntry<Doc>; label: string }
  | { kind: 'out-of-stock'; label: string }
  | { kind: 'choose'; product: Doc }
  | { kind: 'several'; count: number }
  | { kind: 'none' };

export function scanOutcome<Doc>(products: Doc[], traits: ProductTraits<Doc>, code: string, context?: TraitContext): ScanOutcome<Doc> {
  const result = lookupCode(products, traits, code, context);
  if (result.kind === 'entry') {
    const { product, variant } = result.entry;
    const name = traits.getName(product);
    const label = variant.title ? `${name} · ${variant.title}` : name;
    if (variant.stock.status === 'out_of_stock') return { kind: 'out-of-stock', label };
    return { kind: 'add', entry: result.entry, label };
  }
  if (result.kind === 'product') return { kind: 'choose', product: result.product };
  return result;
}

/** v2's scan-miss copy: several matches, or none. */
export function scanMissText(outcome: { kind: 'several'; count: number } | { kind: 'none' }, code: string): string {
  return outcome.kind === 'several'
    ? `Several matches: ${outcome.count} products found — ${code}`
    : `Barcode not found — ${code}`;
}
