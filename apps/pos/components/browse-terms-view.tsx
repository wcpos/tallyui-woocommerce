// v2's browse stage pieces, flat (WCPOS monorepo `packages/core/src/screens/main/pos/products/browse/`):
// the term set as poster tiles (term-tile.tsx, term-grid.tsx) or as table rows (term-row.tsx,
// term-table.tsx), and the crumb above a level (packages/components/src/breadcrumb).
import { Fragment } from 'react';
import type { JSX, ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Path, Rect } from 'react-native-svg';
import { createSvgIcon, Text, VStack } from '@tallyui/components';
import { productsLabel } from '../lib/catalogue/browse-terms';
import type { BrowseTerm } from '../lib/catalogue/browse-terms';
import { tileNameSize, tileWords, useCompactTiles } from '../lib/catalogue/tile-scale';
import { tintOf } from '../lib/catalogue/tile-words';
import { BAND, FAR, NEAR, STACK_CARD, TILE_TINTS } from './product-tile';

const FolderIcon = createSvgIcon('FolderIcon', () => <>
  <Path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
</>);
// v2's `viewGrid` glyph, for All products.
const GridIcon = createSvgIcon('GridIcon', () => <>
  <Rect x={3} y={3} width={7} height={7} rx={1} /><Rect x={14} y={3} width={7} height={7} rx={1} />
  <Rect x={14} y={14} width={7} height={7} rx={1} /><Rect x={3} y={14} width={7} height={7} rx={1} />
</>);
const ChevronRightIcon = createSvgIcon('ChevronRightIcon', () => <Path d="m9 18 6-6-6-6" />);
// v2's chevronLeft, for the parent tile's back badge.
const ChevronLeftIcon = createSvgIcon('ChevronLeftIcon', () => <Path d="m15 18-6-6 6-6" />);

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
 * v2's TermTile face on ProductTile's shape: the square, the band under it and the words at the foot.
 * All products takes the accent fill and a grid glyph; a category its tint (`tintOf(id)`), a folder
 * mark, a bold name of two lines at most and its count under it (none for a count of 0, as v2's
 * `term.count > 0`). A tile that opens onto more is a stack, as v2 draws it. On a compact window the
 * name and its inset take v2's Compact step. `badge` sits at the top right, as v2's poster-tile `back`.
 */
function TermFace({ entry, compact, testID, badge }: { entry: Entry; compact: boolean; testID: string; badge?: ReactNode }): JSX.Element {
  const filled = entry.kind === 'all';
  const surface = filled ? 'bg-primary' : TILE_TINTS[tintOf(entry.id)];
  const ink = filled ? 'text-primary-foreground' : 'text-foreground';
  return <View className="relative">
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View className={STACK_CARD} style={FAR} />
      <View className={STACK_CARD} style={NEAR} />
    </View>
    <View className={`overflow-hidden rounded-lg border border-transparent ${surface}`}>
      <View className="aspect-square w-full" />
      <View style={BAND} />
      <View testID={`${testID}-words`} className={`${tileWords(compact)} pt-2`}>
        <Text testID={`${testID}-name`} className={`${tileNameSize(compact)} font-bold leading-tight ${ink}`} numberOfLines={2}>{labelOf(entry)}</Text>
        {entry.kind === 'term' && entry.count > 0 && <Text className="text-xs text-foreground/70">{productsLabel(entry.count)}</Text>}
      </View>
      <View pointerEvents="none" className="absolute left-2 top-2">
        {filled ? <GridIcon size={24} className={ink} /> : <FolderIcon size={24} className="text-foreground/70" />}
      </View>
      {badge}
    </View>
  </View>;
}

/** v2's TermTile: the face, and tapping it opens the term. */
function TermTile({ entry, compact, onPress }: { entry: Entry; compact: boolean; onPress(): void }): JSX.Element {
  const testID = testIdOf(entry);
  return <Pressable accessibilityRole="button" accessibilityLabel={labelOf(entry)} testID={testID} onPress={onPress}>
    <TermFace entry={entry} compact={compact} testID={testID} />
  </Pressable>;
}

/**
 * v2's ParentTermTile (term-tile.tsx, term-grid.tsx `renderSlot` index 0): the opened place's own tile in
 * slot 0 of its level, the face the root drew for it plus v2's back badge, a round chevron at the top right
 * (poster-tile `back`, a mark inside the tile, not a control of its own). The whole tile is the way back,
 * labelled v2's `common.back`. `count` is the term's count at the root; without it the face shows none.
 */
export function ParentTermTile({ place, count, onBack }: { place: BrowsePlace; count?: number; onBack(): void }): JSX.Element {
  const compact = useCompactTiles();
  const entry: Entry = place.kind === 'all' ? place : { kind: 'term', id: place.id, name: place.name, count: count ?? 0 };
  return <Pressable accessibilityRole="button" accessibilityLabel="Back" testID="browse-parent-tile" onPress={onBack}>
    <TermFace entry={entry} compact={compact} testID="browse-parent-tile" badge={
      <View testID="browse-parent-back" className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-full border border-border bg-card">
        <ChevronLeftIcon size={16} className="text-muted-foreground" />
      </View>} />
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
  const compact = useCompactTiles();
  return <VStack space="none" className="flex-1" testID="browse-root">
    {searchSlot && <View className="px-3 py-2">{searchSlot}</View>}
    <FlatList key={numColumns} data={entriesOf(terms)} numColumns={numColumns} keyExtractor={keyOf} contentContainerClassName="p-1"
      renderItem={({ item }) => <View style={{ width: `${100 / numColumns}%` }} className="p-1">
        <TermTile entry={item} compact={compact} onPress={() => onOpen(placeOf(item))} />
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
// v2's pos_products.products_crumb: the drill-in's default parent (drill-in.tsx).
export const PRODUCTS_LABEL = 'Products';

/**
 * v2's Breadcrumb over a level (browse-stage.tsx `crumb`, term-grid.tsx): the root, the source's label,
 * as a button, a chevron, then the place's name as plain text. With a drilled-in `product` (v2's DrillIn
 * crumb) the place becomes a parent too, the way back to its products, and the product's name ends the
 * row in bold. The last parent carries v2's back testID.
 */
export function BrowseCrumb({ place, onRoot, product }: {
  place: BrowsePlace | null; onRoot(): void; product?: { name: string; onBack(): void };
}): JSX.Element {
  const placeName = place === null ? null : place.kind === 'all' ? ALL_PRODUCTS_LABEL : place.name;
  const parents = [
    ...place === null ? [] : [{ label: CATEGORIES_LABEL, onPress: onRoot }],
    ...product ? [{ label: placeName ?? PRODUCTS_LABEL, onPress: product.onBack }] : [],
  ];
  return <View testID="products-breadcrumb" className="min-h-9 flex-row flex-wrap items-center gap-1">
    {parents.map(({ label, onPress }, index) => <Fragment key={label}>
      <Pressable role="button" accessibilityLabel={label} onPress={onPress}
        testID={index === parents.length - 1 ? 'products-breadcrumb-back' : 'products-breadcrumb-root'}
        className="justify-center rounded-md px-2 py-1 web:hover:bg-muted active:bg-muted">
        <Text className="font-medium text-foreground">{label}</Text>
      </Pressable>
      <ChevronRightIcon size={12} className="text-muted-foreground" />
    </Fragment>)}
    <Text testID="products-breadcrumb-here" className={`shrink px-1 text-foreground ${product ? 'font-bold' : 'font-semibold'}`}>
      {product ? product.name : placeName}
    </Text>
  </View>;
}
