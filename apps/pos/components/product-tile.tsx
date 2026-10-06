import type { JSX } from 'react';
import { Pressable } from 'react-native';
import { useProductTraits } from '@tallyui/core';
import { ProductImage, ProductPrice, ProductStockBadge, ProductTitle, Text, VStack } from '@tallyui/components';
import type { CatalogueTileFields } from '../lib/catalogue/catalogue-view-state';

export function ProductTile({ doc, fields, onPress }: { doc: any; fields: CatalogueTileFields; onPress?(): void }): JSX.Element {
  const traits = useProductTraits();
  const category = traits.getCategoryNames(doc).join(', ');
  const sku = traits.getSku(doc);
  const barcode = traits.getBarcode(doc);
  const content = <VStack testID={`product-tile-${traits.getId(doc)}`} space="sm" className="items-center rounded-lg border border-border bg-card p-3">
    <ProductImage doc={doc} size={80} className="rounded-md" />
    {fields.name && <ProductTitle doc={doc} className="text-sm" numberOfLines={2} />}
    {fields.price && <ProductPrice doc={doc} />}
    {fields.category && category && <Text className="text-xs text-muted-foreground" numberOfLines={1}>{category}</Text>}
    {fields.sku && sku && <Text className="text-xs text-muted-foreground" numberOfLines={1}>{sku}</Text>}
    {fields.barcode && barcode && <Text className="text-xs text-muted-foreground" numberOfLines={1}>{barcode}</Text>}
    {fields.stock && <ProductStockBadge doc={doc} showQuantity />}
  </VStack>;
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}
