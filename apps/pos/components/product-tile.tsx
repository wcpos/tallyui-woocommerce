import type { JSX } from 'react';
import { Pressable, View } from 'react-native';
import { resolvePrice, useProductStock, useProductTraits, useTraitContext } from '@tallyui/core';
import { ProductImage, ProductPrice, ProductTitle, Text, VStack } from '@tallyui/components';
import type { CatalogueTileFields } from '../lib/catalogue/catalogue-view-state';
import { formatTileMoney, isSoldOut, tileStockMark, tileTaxLine } from '../lib/catalogue/tile-words';
import type { TileTax } from '../lib/catalogue/tile-words';
import { InCartBadge } from './in-cart-badge';

export interface ProductTileProps { doc: any; fields: CatalogueTileFields; onPress?(): void; tax?: TileTax; inCart?: number }

export function ProductTile({ doc, fields, onPress, tax, inCart = 0 }: ProductTileProps): JSX.Element {
  const traits = useProductTraits();
  const stock = useProductStock(doc);
  const id = traits.getId(doc);
  const variable = traits.hasVariants(doc);
  const soldOut = isSoldOut(stock, variable);
  const mark = fields.stock ? tileStockMark(stock, variable) : null;
  const category = traits.getCategoryNames(doc).join(', ');
  const sku = traits.getSku(doc);
  const barcode = traits.getBarcode(doc);
  const content = <VStack testID={`product-tile-${id}`} space="sm" className="relative items-center rounded-lg border border-border bg-card p-3">
    <InCartBadge count={inCart} testID={`in-cart-tile-${id}`} className="absolute right-2 top-2 z-10" />
    <ProductImage doc={doc} size={80} className={soldOut ? 'rounded-md opacity-50' : 'rounded-md'} />
    {fields.name && <ProductTitle doc={doc} className="text-sm" numberOfLines={2} />}
    {soldOut ? (fields.price || fields.stock) && <Text testID={`tile-sold-out-${id}`} className="text-sm font-bold">Sold out</Text>
      : fields.price && (variable ? <ProductPrice doc={doc} /> : <TileMoney doc={doc} id={id} fields={fields} tax={tax} />)}
    {fields.category && category && <Text className="text-xs text-muted-foreground" numberOfLines={1}>{category}</Text>}
    {fields.sku && sku && <Text className="text-xs text-muted-foreground" numberOfLines={1}>{sku}</Text>}
    {fields.barcode && barcode && <Text className="text-xs text-muted-foreground" numberOfLines={1}>{barcode}</Text>}
    {mark && <Text testID={`tile-stock-${id}`} className="text-xs text-muted-foreground">{mark.label}</Text>}
  </VStack>;
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}

function TileMoney({ doc, id, fields, tax }: { doc: any; id: string; fields: CatalogueTileFields; tax?: TileTax }): JSX.Element {
  const traits = useProductTraits();
  const context = useTraitContext();
  const resolved = resolvePrice(traits.getPrices(doc, context), context.currency);
  if (!resolved) return <Text className="text-sm text-muted-foreground">-</Text>;
  const line = fields.tax && tax ? tileTaxLine(resolved.current, traits.getTaxStatus?.(doc), traits.getTaxClass?.(doc), tax) : null;
  return <View className="flex-row flex-wrap items-baseline justify-center gap-x-1.5">
    <Text className="text-sm font-bold">{formatTileMoney(resolved.current)}</Text>
    {fields.on_sale && resolved.was && <Text testID={`tile-was-${id}`} className="text-xs text-muted-foreground line-through">{formatTileMoney(resolved.was)}</Text>}
    {line !== null && <Text testID={`tile-tax-${id}`} className="text-xs text-muted-foreground">{line}</Text>}
  </View>;
}
