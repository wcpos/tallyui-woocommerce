import { useState } from 'react';
import type { JSX } from 'react';
import { View } from 'react-native';
import {
  Combobox, ComboboxInput, ComboboxItem, ComboboxTrigger,
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, Text,
} from '@tallyui/components';
import type { PickerGroupState } from '../lib/catalogue/variation-match';
import { ChevronDownIcon, SELECT_FACE } from './select-chevron';

/**
 * v2's VariationSelect (variations-popover/select.tsx:53-122): up to 10 values a "Select an option" select, more a
 * searchable combobox. A value no variant takes with the cashier's other choices is disabled.
 */
export function VariationSelect({ group, selected, onSelect }: {
  group: PickerGroupState; selected?: string; onSelect(value: string): void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const off = (value: string) => group.counts[value] === 0;
  const value = selected ? { value: selected, label: selected } : undefined;
  const pick = (option: { value: string } | undefined) => { if (option && !off(option.value)) onSelect(option.value); };

  if (group.values.length <= 10) {
    return (
      <Select value={value} onValueChange={pick}>
        <SelectTrigger testID={`variation-select-${group.name}`} className={SELECT_FACE} chevron={false}>
          <SelectValue placeholder="Select an option" />
          <ChevronDownIcon size={16} className="text-muted-foreground" />
        </SelectTrigger>
        <SelectContent><SelectGroup>
          {group.values.map(option => <SelectItem key={option} value={option} label={option} testID={`variation-option-${option}`}
            disabled={off(option)} className={off(option) ? 'opacity-50' : undefined}><Text>{option}</Text></SelectItem>)}
        </SelectGroup></SelectContent>
      </Select>
    );
  }

  const term = search.trim().toLowerCase();
  const shown = group.values.filter(option => option.toLowerCase().includes(term));
  return (
    <Combobox value={value} onValueChange={pick} open={open} onOpenChange={setOpen} searchValue={search} onSearchValueChange={setSearch}>
      <ComboboxTrigger testID={`variation-combobox-${group.name}`} className={SELECT_FACE}>
        <Text className={selected ? undefined : 'text-muted-foreground'}>{selected ?? 'Select an option'}</Text>
        <ChevronDownIcon size={16} className="text-muted-foreground" />
      </ComboboxTrigger>
      {/* Inline under the trigger: TallyUI's ComboboxContent portals with no positioning, and its Empty prints fixed copy. */}
      {open ? (
        <View role="list" className="mt-1 rounded-md border border-border bg-popover p-1">
          <ComboboxInput testID="variation-combobox-search" placeholder="Search Variations" className="h-9 px-2" />
          {shown.length ? shown.map(option => <ComboboxItem key={option} value={option} label={option} testID={`variation-option-${option}`}
            disabled={off(option)} className={off(option) ? 'opacity-50' : undefined}><Text>{option}</Text></ComboboxItem>)
            : <Text testID="variation-combobox-empty" className="py-6 text-center text-sm text-muted-foreground">No variation found</Text>}
        </View>
      ) : null}
    </Combobox>
  );
}
