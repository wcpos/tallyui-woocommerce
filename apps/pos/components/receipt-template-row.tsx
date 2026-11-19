import type { JSX } from 'react';
import { View } from 'react-native';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, Text } from '@tallyui/components';
import type { ReceiptTemplate } from '@tallyui/core';
import { ChevronDownIcon, FieldLabel, SELECT_FACE } from './select-chevron';

/**
 * v2's receipt "Template" row (receipt/receipt-body.tsx:84-98, template-switcher.tsx:28-84): a select of the store's
 * receipt templates when it serves more than one, the one template's title otherwise, nothing without templates.
 * TallyUI's ReceiptTemplate carries no offline_capable flag, so v2's offline-disabled items are not drawn.
 */
export function ReceiptTemplateRow({ templates, selectedId, onSelect }: {
  templates: ReceiptTemplate[]; selectedId: string; onSelect(id: string): void;
}): JSX.Element | null {
  if (templates.length === 0) return null;
  const selected = templates.find(template => template.id === selectedId);
  return (
    <View testID="receipt-template-row" className="flex-row items-center gap-3">
      <View className="w-32"><FieldLabel>Template</FieldLabel></View>
      <View className="flex-1">
        {templates.length > 1 ? (
          <Select value={selected ? { value: selected.id, label: selected.title } : undefined}
            onValueChange={option => { if (option) onSelect(option.value); }}>
            <SelectTrigger testID="receipt-template-select" className={SELECT_FACE} chevron={false}>
              <SelectValue placeholder="Select template" />
              <ChevronDownIcon size={16} className="text-muted-foreground" />
            </SelectTrigger>
            <SelectContent><SelectGroup>
              {templates.map(({ id, title }) => <SelectItem key={id} value={id} label={title}
                testID={`receipt-template-${id}`}><Text>{title}</Text></SelectItem>)}
            </SelectGroup></SelectContent>
          </Select>
        ) : <Text testID="receipt-template-title">{templates[0].title}</Text>}
      </View>
    </View>
  );
}
