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
