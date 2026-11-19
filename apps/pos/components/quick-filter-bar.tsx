import type { JSX } from 'react';
import { Pressable, View } from 'react-native';
import { Button, DropdownMenuItem, DropdownMenuSeparator, IconButton, Text, Tooltip, TooltipContent, TooltipTrigger } from '@tallyui/components';
import type { QuickFilter } from '../lib/catalogue/quick-filters';
import { CustomiseMenuItem, DimmedChipTooltip, filterChipClassName, filterChipTextClassName, LongPressMenu } from './catalogue-filter-chips';
import { BookmarkIcon, EditIcon, TrashIcon } from './icons';

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

export type QuickFilterMenu = { onEdit(quickFilter: QuickFilter): void; onCustomise(): void; onRemove(quickFilter: QuickFilter): void };
const ICON = { size: 18, strokeWidth: 1.5 } as const;

/** v2's quick-filter menu (filter-bar.tsx:205-249): Edit, Customise filter bar, then Remove from bar. */
function ChipMenu({ quickFilter, menu, chip }: { quickFilter: QuickFilter; menu: QuickFilterMenu; chip(onLongPress: () => void): JSX.Element }): JSX.Element {
  const id = quickFilter.id;
  return <LongPressMenu chip={chip}>
    <DropdownMenuItem testID={`filter-bar-menu-edit-${id}`} className="gap-2" onPress={() => menu.onEdit(quickFilter)}>
      <EditIcon {...ICON} className="text-foreground" /><Text>{`Edit “${quickFilter.label}”`}</Text></DropdownMenuItem>
    <CustomiseMenuItem id={id} onPress={menu.onCustomise} />
    <DropdownMenuSeparator />
    {/* TallyUI's DropdownMenuItem has no destructive variant (v2 `variant="destructive"`): the row is coloured instead. */}
    <DropdownMenuItem testID={`filter-bar-menu-remove-${id}`} className="gap-2" onPress={() => menu.onRemove(quickFilter)}>
      <TrashIcon {...ICON} className="text-destructive" /><Text className="text-destructive">Remove from bar</Text></DropdownMenuItem>
  </LongPressMenu>;
}

export function QuickFilterBar({ quickFilters, isActive, onPress, dimmed = false, menu }: {
  quickFilters: QuickFilter[];
  isActive(quickFilter: QuickFilter): boolean;
  onPress(quickFilter: QuickFilter): void;
  /** v2 dims quick filters too while a product is drilled into (filter-bar.tsx DimmedChip), each with its tooltip. */
  dimmed?: boolean;
  /** The long-press menu; a dimmed chip opens nothing (v2 filter-bar.tsx:148). */
  menu?: QuickFilterMenu;
}): JSX.Element | null {
  if (quickFilters.length === 0) return null;
  return <View testID="quick-filter-bar" className="flex-row flex-wrap items-center gap-2">
    {quickFilters.map(quickFilter => {
      const active = isActive(quickFilter);
      const chip = (onLongPress?: () => void) => <Pressable key={quickFilter.id} testID={`quick-filter-${quickFilter.id}`} role="button"
        disabled={dimmed} aria-pressed={active} className={filterChipClassName(active, dimmed)} onPress={() => onPress(quickFilter)} onLongPress={onLongPress}>
        <Text className={filterChipTextClassName(active)}>{quickFilter.label}</Text>
      </Pressable>;
      if (dimmed) return <DimmedChipTooltip key={quickFilter.id}>{chip()}</DimmedChipTooltip>;
      return menu ? <ChipMenu key={quickFilter.id} quickFilter={quickFilter} menu={menu} chip={chip} /> : chip();
    })}
  </View>;
}
