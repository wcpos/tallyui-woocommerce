import type { JSX } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@tallyui/components';
import type { QuickFilter } from '../lib/catalogue/quick-filters';
import { filterChipClassName, filterChipTextClassName } from './catalogue-filter-chips';

export function QuickFilterBar({ quickFilters, isActive, onPress }: {
  quickFilters: QuickFilter[];
  isActive(quickFilter: QuickFilter): boolean;
  onPress(quickFilter: QuickFilter): void;
}): JSX.Element | null {
  if (quickFilters.length === 0) return null;
  return <View testID="quick-filter-bar" className="flex-row flex-wrap items-center gap-2">
    {quickFilters.map(quickFilter => {
      const active = isActive(quickFilter);
      return <Pressable key={quickFilter.id} testID={`quick-filter-${quickFilter.id}`} role="button"
        aria-pressed={active} className={filterChipClassName(active)} onPress={() => onPress(quickFilter)}>
        <Text className={filterChipTextClassName(active)}>{quickFilter.label}</Text>
      </Pressable>;
    })}
  </View>;
}
