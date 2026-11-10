import type { JSX } from 'react';
import { ScrollView } from 'react-native';
import { Button, Text } from '@tallyui/components';
import { variantPriceLabel } from '@tallyui/pos';
import type { CatalogueEntry } from '@tallyui/pos';
import type { ProductTraits } from '@tallyui/core';
import { VariationPicker } from './variation-picker';

const stockLabels = { in_stock: 'In stock', out_of_stock: 'Out of stock', backorder: 'Backorder', unknown: 'Stock unknown' };

export function VariantChooser({ entries, currency, traits, onSelect, onClose }: {
  entries: CatalogueEntry<any>[]; currency: string; traits: ProductTraits<any>; onSelect(entry: CatalogueEntry<any>): void; onClose(): void;
}): JSX.Element {
  const groups = entries.length ? traits.getVariantOptions?.(entries[0].product) ?? [] : [];
  // A product whose connector reports option groups gets v2's picker; otherwise the flat list below.
  if (groups.length > 0) {
    return <VariationPicker entries={entries} groups={groups} currency={currency} traits={traits} onSelect={onSelect} onClose={onClose} />;
  }
  return (
    <ScrollView className="flex-1 bg-background p-4">
      <Text>Choose an option</Text>
      {entries.map(entry => (
        <Button key={entry.variant.id} onPress={() => onSelect(entry)}>
          <Text>{entry.variant.title}</Text>
          <Text>{variantPriceLabel(entry.variant, currency)}</Text>
          <Text>{`${stockLabels[entry.variant.stock.status]}${entry.variant.stock.quantity === undefined ? '' : ` · ${entry.variant.stock.quantity}`}`}</Text>
        </Button>
      ))}
      <Button onPress={onClose}><Text>Cancel</Text></Button>
    </ScrollView>
  );
}
