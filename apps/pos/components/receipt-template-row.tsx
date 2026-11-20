import type { JSX } from 'react';
import { View } from 'react-native';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, Text } from '@tallyui/components';
import type { ReceiptTemplate } from '@tallyui/core';
import { useIsWide } from '../lib/layout/wide';
import { ChevronDownIcon, FieldLabel, SELECT_FACE } from './select-chevron';

/**
 * v2's receipt Template and Printer rows (receipt/receipt-body.tsx:84-113) and mismatch badge (receipt/mismatch-badge.tsx:16-33).
 * The Template row (template-switcher.tsx:28-84) is a select of the store's
 * receipt templates when it serves more than one, the one template's title otherwise, nothing without templates.
 * TallyUI's ReceiptTemplate carries no offline_capable flag, so v2's offline-disabled items are not drawn.
 * The app has no saved printers, so Printer always reads v2's browser-dialog text and drops v2's "add one in Settings > Printing" pointer.
 */
export function ReceiptTemplateRow({ templates, selectedId, onSelect }: {
  templates: ReceiptTemplate[]; selectedId: string; onSelect(id: string): void;
}): JSX.Element | null {
  const wide = useIsWide();
  if (templates.length === 0) return null;
  const selected = templates.find(template => template.id === selectedId);
  return (
    // v2's PropertyRow (components property-row/index.tsx:103,147-163): one line off a phone, the key stacked above on one.
    <View testID="receipt-print-properties" className="gap-2">
    <View testID="receipt-template-row" className={wide ? 'flex-row items-center gap-3' : 'gap-1'}>
      <View className={wide ? 'w-32 shrink-0' : undefined}><FieldLabel>Template</FieldLabel></View>
      <View className={wide ? 'min-w-0 flex-1' : undefined}>
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
    <View testID="receipt-printer-row" className={wide ? 'flex-row items-center gap-3' : 'gap-1'}>
      <View className={wide ? 'w-32 shrink-0' : undefined}><FieldLabel>Printer</FieldLabel></View>
      <View className={wide ? 'min-w-0 flex-1' : undefined}><Text testID="receipt-printer-value">Browser print dialog</Text></View>
    </View>
    {selected?.engine === 'thermal' && (
      <View testID="receipt-printer-mismatch-box" role="status" className="rounded-lg border border-warning/45 bg-warning/15 px-3 py-1.5">
        <Text testID="receipt-printer-mismatch" className="text-xs text-warning-text">This thermal template will print its on-screen preview through the print dialog. To print it as designed, choose an HTML template.</Text>
      </View>
    )}
    </View>
  );
}
