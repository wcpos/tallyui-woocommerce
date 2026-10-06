import type { ProductTraits } from '@tallyui/core';
import type { CatalogueEntry } from '@tallyui/pos';

export function simpleEntry<Doc>(doc: Doc, traits: ProductTraits<Doc>, currency: string): CatalogueEntry<Doc> | null {
  if (traits.getVariantCount(doc) > 1 || (doc as any).type === 'variable') return null;
  // A WooCommerce simple product is its own single variant, until G2 adds getVariants to the connector.
  return {
    product: doc,
    variant: {
      id: traits.getId(doc),
      sku: traits.getSku(doc),
      barcode: traits.getBarcode(doc),
      prices: traits.getPrices(doc, { currency }),
      stock: traits.getStock(doc),
    },
  };
}
