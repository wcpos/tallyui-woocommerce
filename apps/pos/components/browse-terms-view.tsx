// v2's browse stage pieces, flat (WCPOS monorepo `packages/core/src/screens/main/pos/products/browse/`):
// the term set as poster tiles (term-tile.tsx, term-grid.tsx) or as table rows (term-row.tsx,
// term-table.tsx), and the crumb above a level (packages/components/src/breadcrumb).
import type { JSX, ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Path, Rect } from 'react-native-svg';
import { createSvgIcon, Text, VStack } from '@tallyui/components';
import { productsLabel } from '../lib/catalogue/browse-terms';
import type { BrowseTerm } from '../lib/catalogue/browse-terms';
import { tintOf } from '../lib/catalogue/tile-words';
import { BAND, FAR, NEAR, STACK_CARD, TILE_TINTS, WORDS } from './product-tile';

const FolderIcon = createSvgIcon('FolderIcon', () => <>
  <Path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
</>);
// v2's `viewGrid` glyph, for All products.
const GridIcon = createSvgIcon('GridIcon', () => <>
  <Rect x={3} y={3} width={7} height={7} rx={1} /><Rect x={14} y={3} width={7} height={7} rx={1} />
  <Rect x={14} y={14} width={7} height={7} rx={1} /><Rect x={3} y={14} width={7} height={7} rx={1} />
</>);
const ChevronRightIcon = createSvgIcon('ChevronRightIcon', () => <Path d="m9 18 6-6-6-6" />);

/** What a cashier can open from the term set: All products, or one category. */
export type BrowsePlace = { kind: 'all' } | { kind: 'term'; id: number; name: string };

export const ALL_PRODUCTS_LABEL = 'All products';

type Entry = { kind: 'all' } | ({ kind: 'term' } & BrowseTerm);

const placeOf = (entry: Entry): BrowsePlace => entry.kind === 'all' ? entry : { kind: 'term', id: entry.id, name: entry.name };
const testIdOf = (entry: Entry) => entry.kind === 'all' ? 'browse-all-products' : `browse-term-${entry.id}`;
const labelOf = (entry: Entry) => entry.kind === 'all' ? ALL_PRODUCTS_LABEL : entry.name;
const entriesOf = (terms: readonly BrowseTerm[]): Entry[] => [{ kind: 'all' }, ...terms.map(term => ({ kind: 'term' as const, ...term }))];
const keyOf = (entry: Entry) => entry.kind === 'all' ? 'all' : `term-${entry.id}`;

/**
 * v2's TermTile on ProductTile's shape: the square, the band under it and the words at the foot.
 * All products takes the accent fill and a grid glyph; a category its tint (`tintOf(id)`), a folder
 * mark, a bold name of two lines at most and its count under it. A tile that opens onto more is a
 * stack, as v2 draws it.
 */
function TermTile({ entry, onPress }: { entry: Entry; onPress(): void }): JSX.Element {
  const filled = entry.kind === 'all';
  const surface = filled ? 'bg-primary' : TILE_TINTS[tintOf(entry.id)];
  const ink = filled ? 'text-primary-foreground' : 'text-foreground';
  const label = labelOf(entry);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} testID={testIdOf(entry)} onPress={onPress}>
    <View className="relative">
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View className={STACK_CARD} style={FAR} />
        <View className={STACK_CARD} style={NEAR} />
      </View>
      <View className={`overflow-hidden rounded-lg border border-transparent ${surface}`}>
        <View className="aspect-square w-full" />
        <View style={BAND} />
        <View className={`${WORDS} pt-2`}>
          <Text className={`text-base font-bold leading-tight ${ink}`} numberOfLines={2}>{label}</Text>
          {entry.kind === 'term' && <Text className="text-xs text-foreground/70">{productsLabel(entry.count)}</Text>}
        </View>
        <View pointerEvents="none" className="absolute left-2 top-2">
          {filled ? <GridIcon size={24} className={ink} /> : <FolderIcon size={24} className="text-foreground/70" />}
        </View>
      </View>
    </View>
  </Pressable>;
}

/** v2's TermRow: a tinted folder thumb, the name and its count, a chevron at the end. */
function TermRow({ entry, onPress }: { entry: Entry; onPress(): void }): JSX.Element {
  const filled = entry.kind === 'all';
  const label = labelOf(entry);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} testID={testIdOf(entry)} onPress={onPress}
    className="flex-row items-center gap-3 border-b border-border px-4 py-2 web:hover:bg-muted/50">
    <View className={`h-10 w-10 items-center justify-center rounded-md ${filled ? 'bg-primary' : TILE_TINTS[tintOf(entry.id)]}`}>
      {filled ? <GridIcon size={18} className="text-primary-foreground" /> : <FolderIcon size={18} className="text-foreground/70" />}
    </View>
    <View className="flex-1 gap-0.5">
      <Text className="font-bold" numberOfLines={1}>{label}</Text>
      {entry.kind === 'term' && <Text className="text-sm text-muted-foreground" numberOfLines={1}>{productsLabel(entry.count)}</Text>}
    </View>
    <ChevronRightIcon size={16} className="text-muted-foreground" />
  </Pressable>;
}

/** The term set at the root as the product grid lays it out: All products first, then the terms, on the grid's columns. */
export function BrowseRootGrid({ terms, numColumns, searchSlot, onOpen }: {
  terms: readonly BrowseTerm[]; numColumns: number; searchSlot?: ReactNode; onOpen(place: BrowsePlace): void;
}): JSX.Element {
  return <VStack space="none" className="flex-1" testID="browse-root">
    {searchSlot && <View className="px-3 py-2">{searchSlot}</View>}
    <FlatList key={numColumns} data={entriesOf(terms)} numColumns={numColumns} keyExtractor={keyOf} contentContainerClassName="p-1"
      renderItem={({ item }) => <View style={{ width: `${100 / numColumns}%` }} className="p-1">
        <TermTile entry={item} onPress={() => onOpen(placeOf(item))} />
      </View>} />
  </VStack>;
}

/** The term set at the root as rows of the products table: All products first, then the terms. */
export function BrowseRootTable({ terms, searchSlot, onOpen }: {
  terms: readonly BrowseTerm[]; searchSlot?: ReactNode; onOpen(place: BrowsePlace): void;
}): JSX.Element {
  return <VStack space="none" className="flex-1" testID="browse-root">
    {searchSlot && <View className="px-3 py-2">{searchSlot}</View>}
    <FlatList data={entriesOf(terms)} keyExtractor={keyOf} renderItem={({ item }) => <TermRow entry={item} onPress={() => onOpen(placeOf(item))} />} />
  </VStack>;
}

// v2's useSourceLabel(source) for Browse by Categories: the crumb's root is the source.
export const CATEGORIES_LABEL = 'Categories';

/**
 * v2's Breadcrumb over a level (browse-stage.tsx `crumb`, term-grid.tsx): the root, the source's label,
 * as a button, a chevron, then the place's name as plain text. Its one parent is the last, so it carries
 * v2's back testID.
 */
export function BrowseCrumb({ place, onRoot }: { place: BrowsePlace; onRoot(): void }): JSX.Element {
  return <View testID="products-breadcrumb" className="min-h-9 flex-row flex-wrap items-center gap-1">
    <Pressable role="button" accessibilityLabel={CATEGORIES_LABEL} testID="products-breadcrumb-back" onPress={onRoot}
      className="justify-center rounded-md px-2 py-1 web:hover:bg-muted active:bg-muted">
      <Text className="font-medium text-foreground">{CATEGORIES_LABEL}</Text>
    </Pressable>
    <ChevronRightIcon size={12} className="text-muted-foreground" />
    <Text testID="products-breadcrumb-here" className="shrink px-1 font-semibold text-foreground">{place.kind === 'all' ? ALL_PRODUCTS_LABEL : place.name}</Text>
  </View>;
}
