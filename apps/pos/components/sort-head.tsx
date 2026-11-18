import type { JSX } from 'react';
import { Pressable, View } from 'react-native';
import { Line } from 'react-native-svg';
import { Text, createSvgIcon } from '@tallyui/components';
import type { TableSort } from '../lib/table-sort';

const SortAscIcon = createSvgIcon('SortAscIcon', () => <><Line x1={6} y1={15} x2={12} y2={9} /><Line x1={12} y1={9} x2={18} y2={15} /></>);
const SortDescIcon = createSvgIcon('SortDescIcon', () => <><Line x1={6} y1={9} x2={12} y2={15} /><Line x1={12} y1={15} x2={18} y2={9} /></>);

/** A sortable table head. v2 header.tsx:40-80, sort-icon/index.tsx: one-line labels, the sorted chevron text-foreground,
 *  a muted up chevron on a hovered unsorted head (Pressable's `hovered`), else none. */
export function SortHead({ id, label, sort, onSort, chevronTestID }: {
  id: string; label: string; sort: TableSort<string>; onSort(): void; chevronTestID: string;
}): JSX.Element {
  return <Pressable testID={`data-table-header-${id}`} accessibilityRole="button" onPress={onSort}>
    {({ hovered }: { hovered?: boolean }) => <View testID={sort.field === id ? `data-table-sort-${id}-${sort.direction}` : undefined} className="max-w-full flex-row items-center gap-1">
      <Text numberOfLines={1} className="shrink">{label}</Text>
      {sort.field === id ? (sort.direction === 'asc' ? <SortAscIcon testID={chevronTestID} size={12} className="text-foreground" />
        : <SortDescIcon testID={chevronTestID} size={12} className="text-foreground" />)
        : hovered ? <SortAscIcon testID={`data-table-sort-${id}-hover`} size={12} className="text-muted-foreground" /> : null}
    </View>}
  </Pressable>;
}
