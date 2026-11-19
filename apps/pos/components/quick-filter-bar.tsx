import type { JSX } from 'react';
import { Pressable, View } from 'react-native';
import { Button, IconButton, Text, Tooltip, TooltipContent, TooltipTrigger } from '@tallyui/components';
import type { QuickFilter } from '../lib/catalogue/quick-filters';
import { DimmedChipTooltip, filterChipClassName, filterChipTextClassName } from './catalogue-filter-chips';
import { BookmarkIcon } from './icons';

/** v2's bare bookmark after the chips (filter-bar.tsx:538-553), shown while a filter is on. */
export function SaveAsButton({ onPress }: { onPress(): void }): JSX.Element {
  return <Tooltip>
    <TooltipTrigger asChild>
      <IconButton testID="filter-bar-save-as-button" variant="ghost" className="h-11 w-11" accessibilityLabel="Save as button" onPress={onPress}>
        <BookmarkIcon size={18} className="text-muted-foreground" />
      </IconButton>
    </TooltipTrigger>
    <TooltipContent><Text>Save as button</Text></TooltipContent>
  </Tooltip>;
}

/** v2's Clear all after the chips (filter-bar.tsx:528-537): a link, shown once two filters are on (core.json:1213). */
export function ClearAllButton({ onPress }: { onPress(): void }): JSX.Element {
  return <Button testID="filter-bar-clear-all" variant="link" size="sm" onPress={onPress}><Text>Clear all</Text></Button>;
}

export function QuickFilterBar({ quickFilters, isActive, onPress, dimmed = false }: {
  quickFilters: QuickFilter[];
  isActive(quickFilter: QuickFilter): boolean;
  onPress(quickFilter: QuickFilter): void;
  /** v2 dims quick filters too while a product is drilled into (filter-bar.tsx DimmedChip), each with its tooltip. */
  dimmed?: boolean;
}): JSX.Element | null {
  if (quickFilters.length === 0) return null;
  return <View testID="quick-filter-bar" className="flex-row flex-wrap items-center gap-2">
    {quickFilters.map(quickFilter => {
      const active = isActive(quickFilter);
      const chip = <Pressable key={quickFilter.id} testID={`quick-filter-${quickFilter.id}`} role="button"
        disabled={dimmed} aria-pressed={active} className={filterChipClassName(active, dimmed)} onPress={() => onPress(quickFilter)}>
        <Text className={filterChipTextClassName(active)}>{quickFilter.label}</Text>
      </Pressable>;
      return dimmed ? <DimmedChipTooltip key={quickFilter.id}>{chip}</DimmedChipTooltip> : chip;
    })}
  </View>;
}
