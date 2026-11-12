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
import { useIsWide } from '../lib/layout/wide';
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
        {/* v2's bare mark on a filled or tinted tile (poster-tile/index.tsx:364 `bare={tint !== null || filled}`) is the
            Icon's `lg`, 20 px (mark.tsx:44, icon/index.tsx:30 `size-5`), the grid in the tile's ink, the folder muted. */}
        {filled ? <GridIcon testID={`${testID}-mark`} size={20} className={ink} /> : <FolderIcon testID={`${testID}-mark`} size={20} className="text-foreground/70" />}
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

// v2's term-row.tsx:17,19: the products table's image and actions column widths.
const IMAGE_CELL = { width: 68 };
const ACTIONS_CELL = { width: 60 };
// v2's PosterThumb `stacked` (poster-tile/thumb.tsx:36): the box keeps room for the far card it draws past.
const STACK_ROOM = { marginRight: FAR.top, marginBottom: FAR.top };

/**
 * v2's TermRow on a fine pointer (term-row.tsx:54-112 over list-row/index.tsx:55): a 44 row with its hairline
 * and no padding of its own, as the cells carry it (term-row.tsx:60-61): the 68 image cell's `px-3 py-1.5` round
 * a stacked 40 thumb (`size="sm"`, thumb.tsx:33) with a 20 bare mark (mark.tsx:44), the body's `px-3 py-1.5`,
 * the chevron centred in the 60 actions cell. 6 + 40 + 6 + 6 + 1 = 59 px, as v2's.
 */
function TermRow({ entry, onPress }: { entry: Entry; onPress(): void }): JSX.Element {
  const filled = entry.kind === 'all';
  const label = labelOf(entry);
  const testID = testIdOf(entry);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} testID={testID} onPress={onPress}
    className="min-h-11 flex-row items-center border-b border-border px-0 py-0 active:bg-accent web:hover:bg-accent">
    <View style={IMAGE_CELL} className="px-3 py-1.5">
      <View className="relative h-10 w-10" style={STACK_ROOM}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View className={STACK_CARD} style={FAR} />
          <View className={STACK_CARD} style={NEAR} />
        </View>
        <View className={`h-full w-full items-center justify-center overflow-hidden rounded-lg border border-transparent ${filled ? 'bg-primary' : TILE_TINTS[tintOf(entry.id)]}`}>
          {filled ? <GridIcon size={20} className="text-primary-foreground" /> : <FolderIcon size={20} className="text-muted-foreground" />}
        </View>
      </View>
    </View>
    <View className="min-w-0 flex-1 gap-0.5 px-3 py-1.5">
      <Text className="font-bold" numberOfLines={1}>{label}</Text>
      {/* v2's `variant="help"` (text/ladder.ts:15), and no count for a count of 0 (term-row.tsx:45-49). */}
      {entry.kind === 'term' && entry.count > 0 && <Text className="text-xs text-muted-foreground" numberOfLines={1}>{productsLabel(entry.count)}</Text>}
    </View>
    {/* v2's chevron at the Icon's default 18 (icon/index.tsx:27) in a row-sized target (term-row.tsx:66-76). */}
    <View style={ACTIONS_CELL} className="items-center">
      <View className="min-w-11 items-center"><ChevronRightIcon size={18} className="text-muted-foreground" /></View>
    </View>
  </Pressable>;
}

/** The term set at the root as the product grid lays it out: All products first, then the terms, on the grid's columns. */
export function BrowseRootGrid({ terms, numColumns, searchSlot, onOpen }: {
  terms: readonly BrowseTerm[]; numColumns: number; searchSlot?: ReactNode; onOpen(place: BrowsePlace): void;
}): JSX.Element {
  const compact = useCompactTiles();
  // v2's tile ground (data-table/surface.tsx:49-56 `TileGround`, lib/ground.ts:46-72 `tiles`): the tiles a gutter from
  // the column's edge, 12 in a window (`px-2` plus the cell's 4) and 16 on a phone (`px-3` plus 4); in a window the first
  // row stands right under the chip row's own 12 (TileGround's `-mt-1` over the cells' `p-1`), so a cell pads only below.
  const wide = useIsWide();
  const tiles = wide ? 'px-2' : 'px-3 py-1';
  return <VStack space="none" className="flex-1" testID="browse-root">
    {searchSlot && <View className="px-3 py-2">{searchSlot}</View>}
    <FlatList key={numColumns} testID="browse-root-tiles" data={entriesOf(terms)} numColumns={numColumns} keyExtractor={keyOf} contentContainerClassName={tiles}
      renderItem={({ item }) => <View style={{ width: `${100 / numColumns}%` }} className={wide ? 'px-1 pb-2' : 'p-1'}>
        <TermTile entry={item} compact={compact} onPress={() => onOpen(placeOf(item))} />
      </View>} />
  </VStack>;
}

/**
 * The term set at the root as rows of the products table: All products first, then the terms, on v2's table
 * card (term-table.tsx:58-72, data-table/surface.tsx:31-36): white, a hairline border, rounded, inset by the
 * page gutter (`mx-gutter`, the search slot's `px-3` here) in a window; edge to edge under a hairline on a phone.
 */
export function BrowseRootTable({ terms, searchSlot, onOpen }: {
  terms: readonly BrowseTerm[]; searchSlot?: ReactNode; onOpen(place: BrowsePlace): void;
}): JSX.Element {
  const card = useIsWide() ? 'mx-3 mb-2 overflow-hidden rounded-lg border' : 'mb-2 border-t';
  return <VStack space="none" className="flex-1" testID="browse-root">
    {searchSlot && <View className="px-3 py-2">{searchSlot}</View>}
    <View testID="browse-root-card" className={`min-h-0 flex-1 border-border bg-card ${card}`}>
      <FlatList data={entriesOf(terms)} keyExtractor={keyOf} renderItem={({ item }) => <TermRow entry={item} onPress={() => onOpen(placeOf(item))} />} />
    </View>
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
export function BrowseCrumb({ place, onRoot, product, className = 'min-h-9' }: {
  place: BrowsePlace | null; onRoot(): void; product?: { name: string; onBack(): void }; className?: string;
}): JSX.Element {
  const placeName = place === null ? null : place.kind === 'all' ? ALL_PRODUCTS_LABEL : place.name;
  const parents = [
    ...place === null ? [] : [{ label: CATEGORIES_LABEL, onPress: onRoot }],
    ...product ? [{ label: placeName ?? PRODUCTS_LABEL, onPress: product.onBack }] : [],
  ];
  return <View testID="products-breadcrumb" className={`flex-row flex-wrap items-center gap-1 ${className}`}>
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
