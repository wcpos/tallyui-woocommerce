import type { JSX, ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { resolvePrice, resolvePriceRange, useProductStock, useProductTraits, useTraitContext } from '@tallyui/core';
import { ProductImage, ProductTitle, Text } from '@tallyui/components';
import type { CatalogueTileFields } from '../lib/catalogue/catalogue-view-state';
import { formatTileMoney, isSoldOut, optionsLabel, tileStockMark, tileTaxLine, tileTint } from '../lib/catalogue/tile-words';
import type { TileTax } from '../lib/catalogue/tile-words';
import { InCartBadge } from './in-cart-badge';

export interface ProductTileProps { doc: any; fields: CatalogueTileFields; onPress?(): void; tax?: TileTax; inCart?: number }

// v2's poster-tile/style.ts: literal classes, so the stylesheet keeps them (tokens in global.css).
export const TILE_TINTS = ['bg-tile-tint-0', 'bg-tile-tint-1', 'bg-tile-tint-2', 'bg-tile-tint-3', 'bg-tile-tint-4', 'bg-tile-tint-5'] as const;
// v2's two cards under a stacked tile, inside the 8 px the grid cells' p-1 leave between tiles.
export const NEAR = { top: 3, left: 3, right: -3, bottom: -3 };
export const FAR = { top: 6, left: 6, right: -6, bottom: -6, opacity: 0.6 };
export const STACK_CARD = 'absolute rounded-lg border border-border bg-card';
// v2 greys a sold-out picture to opacity-40; inline so it holds whatever the theme.
const SOLD_OUT = { opacity: 0.4 };
// The picture fills its square (ProductImage's style overrides its size).
const FILL = { width: '100%', height: '100%' } as const;
// v2's POSTER_BAND: one line of name (16 px x 1.25), the money row (16 px x 1.35), a 2 px gap and the 10 px foot.
export const BAND = { height: 54 };
// v2's scrim-stops.ts: the fade reaches 48 px above the words and eases up to 92% card colour.
const SCRIM_REACH = 48;
const SCRIM_STRENGTH = 0.92;
const SCRIM_STOPS: readonly (readonly [number, number])[] = [
  [0, 0], [0.018, 0.002], [0.048, 0.008], [0.09, 0.021], [0.139, 0.042], [0.198, 0.075], [0.27, 0.126],
  [0.35, 0.194], [0.435, 0.278], [0.53, 0.382], [0.66, 0.541], [0.81, 0.738], [1, 1],
];
// v2's scrim-stops.ts SCRIM_BLUR_PX: the picture under the words is blurred by 6 px, masked by the fade so it has no edge.
const SCRIM_BLUR_PX = 6;
const scrimCard = (of: number) => `color-mix(in srgb, var(--color-card) ${(of * SCRIM_STRENGTH * 100).toFixed(2)}%, transparent)`;
// v2's scrim.tsx MASK: the fade's stops as alpha, so the blur fades in exactly with the tint.
const SCRIM_MASK = `linear-gradient(to bottom, ${[...SCRIM_STOPS.map(([at, of]) => `rgb(0 0 0 / ${of}) ${at * SCRIM_REACH}px`), '#000 100%'].join(', ')})`;
const SCRIM_BLUR = `blur(${SCRIM_BLUR_PX}px)`;
// v2's scrim.tsx web gradient; native has no CSS gradient, so it takes a flat card band instead.
const SCRIM_STYLE = Platform.OS === 'web'
  ? { paddingTop: SCRIM_REACH, backgroundImage: `linear-gradient(to bottom, ${[...SCRIM_STOPS.map(([at, of]) => `${scrimCard(of)} ${at * SCRIM_REACH}px`), `${scrimCard(1)} 100%`].join(', ')})` } as ViewStyle
  : { paddingTop: 8 } as ViewStyle;
// v2's scrim.tsx BLUR (`poster-scrim-blur`): its own layer, so the mask shapes the blur and never the fade. Web only.
const SCRIM_BLUR_STYLE = {
  position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
  backdropFilter: SCRIM_BLUR, WebkitBackdropFilter: SCRIM_BLUR, maskImage: SCRIM_MASK, WebkitMaskImage: SCRIM_MASK,
} as ViewStyle;
export const WORDS = 'absolute bottom-0 left-0 right-0 max-h-full gap-0.5 overflow-hidden px-2.5 pb-2.5';

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
  const options = variable ? optionsLabel(traits.getVariantCount(doc)) : null;
  const lines: ReactNode[] = [
    fields.name && <ProductTitle key="name" doc={doc} className="text-base font-bold leading-tight" numberOfLines={2} />,
    soldOut ? (fields.price || fields.stock) && <Text key="money" testID={`tile-sold-out-${id}`} className="text-base font-bold">Sold out</Text>
      : fields.price && <TileMoney key="money" doc={doc} id={id} fields={fields} tax={tax} variable={variable} />,
    options && <Text key="options" testID={`tile-options-${id}`} className="text-xs text-foreground/70">{options}</Text>,
    fields.category && category && <Text key="category" className="text-xs text-muted-foreground" numberOfLines={1}>{category}</Text>,
    fields.sku && sku && <Text key="sku" className="text-xs text-muted-foreground" numberOfLines={1}>{sku}</Text>,
    fields.barcode && barcode && <Text key="barcode" className="text-xs text-muted-foreground" numberOfLines={1}>{barcode}</Text>,
  ].filter(Boolean);
  const content = <View testID={`product-tile-${id}`} className="relative">
    {variable && <View testID={`tile-stack-${id}`} pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View className={STACK_CARD} style={FAR} />
      <View className={STACK_CARD} style={NEAR} />
    </View>}
    <TilePoster doc={doc} testKey={id} soldOut={soldOut} lines={lines}>
      {mark && <Text testID={`tile-stock-${id}`} className="absolute left-2 top-2 rounded-md bg-card/90 px-1.5 py-0.5 text-xs font-semibold">{mark.label}</Text>}
      <InCartBadge count={inCart} testID={`in-cart-tile-${id}`} className="absolute right-2 top-2 z-10" />
    </TilePoster>
  </View>;
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress}>{content}</Pressable> : content;
}

/**
 * v2's PosterTile card, shared by the product and the variation tiles: `doc`'s picture (or its tint and initial),
 * the band, the words on the scrim, then `children` (the corner marks) painted last.
 */
export function TilePoster({ doc, testKey, soldOut, lines, children }: {
  doc: any; testKey: string; soldOut: boolean; lines: ReactNode[]; children?: ReactNode;
}): JSX.Element {
  const traits = useProductTraits();
  const imageUrl = traits.getImageUrl(doc);
  const tint = imageUrl ? null : tileTint(traits.getCategories?.(doc) ?? [], traits.getName(doc));
  const initial = traits.getName(doc).trim().charAt(0).toUpperCase();
  return <View className={`overflow-hidden rounded-lg border ${tint === null ? 'border-border bg-card' : `${TILE_TINTS[tint]} border-transparent`}`}>
    <View className="aspect-square w-full overflow-hidden">
      <View testID={`tile-picture-${testKey}`} className="h-full w-full" style={soldOut ? SOLD_OUT : undefined}>
        {imageUrl
          ? <ProductImage testID={`tile-image-${testKey}`} doc={doc} style={FILL} className="rounded-none border-0" />
          : initial !== '' && <View testID={`tile-initial-${testKey}`} pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <Text className="text-3xl font-bold text-foreground">{initial}</Text>
          </View>}
      </View>
    </View>
    <View style={BAND} />
    {lines.length > 0 && (tint === null
      ? <View testID={`tile-scrim-${testKey}`} className={Platform.OS === 'web' ? WORDS : `${WORDS} bg-card/90`} style={SCRIM_STYLE}>
        {/* First in the tree, as v2's, so the words paint above it. */}
        {Platform.OS === 'web' && <View testID={`tile-scrim-blur-${testKey}`} pointerEvents="none" style={SCRIM_BLUR_STYLE} />}
        {lines}
      </View>
      : <View className={`${WORDS} pt-2`}>{lines}</View>)}
    {children}
  </View>;
}

/**
 * v2's moneyRow (tiles/tile-words.tsx): the price in bold, the struck regular price with On Sale, the tax line.
 * A variable product reads its variants' range (v2's useProductWords with `drill`): a muted "from" before the
 * lowest price when the prices differ, and the cheapest variant's regular price struck when it is on sale.
 */
function TileMoney({ doc, id, fields, tax, variable }: { doc: any; id: string; fields: CatalogueTileFields; tax?: TileTax; variable: boolean }): JSX.Element {
  const traits = useProductTraits();
  const context = useTraitContext();
  const variants = variable ? traits.getVariants?.(doc, context) ?? [] : [];
  const range = variable ? resolvePriceRange(variants, context.currency) : undefined;
  const resolved = !variable ? resolvePrice(traits.getPrices(doc, context), context.currency)
    : range && variants.map(variant => resolvePrice(variant.prices, context.currency))
      .find(price => price?.current.amount === range.min.amount && price.current.currency === range.min.currency);
  if (!resolved) return <Text className="text-base text-muted-foreground">-</Text>;
  const from = range !== undefined && range.min.amount !== range.max.amount;
  const line = fields.tax && tax ? tileTaxLine(resolved.current, traits.getTaxStatus?.(doc), traits.getTaxClass?.(doc), tax) : null;
  return <View className="flex-row flex-wrap items-baseline gap-x-1.5">
    {from && <Text testID={`tile-from-${id}`} className="text-xs text-muted-foreground">from</Text>}
    <Text testID={`tile-price-${id}`} className="text-base font-bold">{formatTileMoney(resolved.current)}</Text>
    {fields.on_sale && resolved.was && <Text testID={`tile-was-${id}`} className="text-xs text-muted-foreground line-through">{formatTileMoney(resolved.was)}</Text>}
    {line !== null && <Text testID={`tile-tax-${id}`} className="text-xs text-muted-foreground">{line}</Text>}
  </View>;
}
