import type { JSX } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import type { QuickFilter } from '../lib/catalogue/quick-filters';

export function QuickFilterBar({ quickFilters, isActive, onPress }: {
  quickFilters: QuickFilter[];
  isActive(quickFilter: QuickFilter): boolean;
  onPress(quickFilter: QuickFilter): void;
}): JSX.Element | null {
  if (quickFilters.length === 0) return null;
  return <View testID="quick-filter-bar" className="flex-row flex-wrap items-center gap-2">
    {quickFilters.map(quickFilter => {
      const active = isActive(quickFilter);
      return <Button key={quickFilter.id} testID={`quick-filter-${quickFilter.id}`}
        variant={active ? 'default' : 'outline'} aria-pressed={active} onPress={() => onPress(quickFilter)}>
        <Text>{quickFilter.label}</Text>
      </Button>;
    })}
  </View>;
}
