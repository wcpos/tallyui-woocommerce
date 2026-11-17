// v2's drilled-in grid tiles (WCPOS monorepo `packages/core/src/screens/main/pos/products/tiles/variation-tile.tsx`,
// `option-chips.tsx`): the parent's own tile in the first slot with the back badge, then one tile per variation.
import type { JSX } from 'react';
import { Pressable, View } from 'react-native';
import { resolvePrice, useProductTraits, useTraitContext } from '@tallyui/core';
import { Text } from '@tallyui/components';
import type { CatalogueEntry } from '@tallyui/pos';
import type { CatalogueTileFields } from '../lib/catalogue/catalogue-view-state';
import { formatTileMoney } from '../lib/catalogue/tile-words';
import type { TileTax } from '../lib/catalogue/tile-words';
import { ChevronLeftIcon } from './icons';
import { ProductTile, TilePoster } from './product-tile';

/** v2's ParentTile: the tapped product's tile, its back badge (v2's CIRCLE) where its cart count was. */
export function ParentTile({ doc, fields, tax, onBack }: { doc: any; fields: CatalogueTileFields; tax?: TileTax; onBack(): void }): JSX.Element {
  return <View className="relative">
    <ProductTile doc={doc} fields={fields} tax={tax} />
    <Pressable testID="drill-back" accessibilityRole="button" accessibilityLabel="Back" onPress={onBack}
      className="absolute right-2 top-2 z-10 h-7 w-7 items-center justify-center rounded-full border border-border bg-card">
      <ChevronLeftIcon size={16} className="text-muted-foreground" />
    </Pressable>
  </View>;
}

/** What a variation's tile and its row both show: its name, its values as v2's OptionChips, its price or Sold out. */
function useVariationParts(entry: CatalogueEntry<any>) {
  const traits = useProductTraits();
  const context = useTraitContext();
  const { product, variant } = entry;
  const id = variant.id;
  const out = variant.stock.status === 'out_of_stock';
  const price = resolvePrice(variant.prices, context.currency);
  const options = Object.entries(variant.options ?? {});
  const chips = options.length > 0 ? options : variant.title ? [['title', variant.title] as const] : [];
  const name = traits.getName(product);
  return {
    id, out, name,
    label: variant.title ? `${name} · ${variant.title}` : name,
    chips: chips.length > 0 && <View key="chips" className="flex-row flex-wrap gap-1">
      {chips.map(([group, value]) => <Text key={group} testID={`variation-chip-${id}-${group}`}
        className="rounded bg-muted px-1.5 py-px text-xs font-semibold" numberOfLines={1}>{value}</Text>)}
    </View>,
    money: out ? <Text key="money" testID={`variation-sold-out-${id}`} className="text-base font-bold">Sold out</Text>
      : price && <Text key="money" testID={`variation-price-${id}`} className="text-base font-bold">{formatTileMoney(price.current)}</Text>,
  };
}

/**
 * v2's VariationTile: the parent's picture, its name small and muted, the variation's values as v2's OptionChips,
 * then its price in bold, or Sold out over a greyed picture. The tile is the add control.
 */
export function VariationTile({ entry, onPress }: { entry: CatalogueEntry<any>; onPress(): void }): JSX.Element {
  const { id, out, name, label, chips, money } = useVariationParts(entry);
  const lines = [
    <Text key="name" className="text-xs text-muted-foreground" numberOfLines={1}>{name}</Text>, chips, money,
  ].filter(Boolean);
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    testID={`variation-tile-${id}`} onPress={onPress}>
    <TilePoster doc={entry.product} testKey={`variation-${id}`} soldOut={out} lines={lines} />
  </Pressable>;
}

/** v2's drilled-in table (drill-in.tsx): one row per variation, its values then its price or Sold out. The row adds it. */
export function VariationRow({ entry, onPress }: { entry: CatalogueEntry<any>; onPress(): void }): JSX.Element {
  const { id, label, chips, money } = useVariationParts(entry);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} testID={`variation-row-${id}`} onPress={onPress}
    className="min-h-11 flex-row items-center gap-3 border-b border-border px-3 py-2">
    <View className="flex-1">{chips}</View>
    {money}
  </Pressable>;
}
