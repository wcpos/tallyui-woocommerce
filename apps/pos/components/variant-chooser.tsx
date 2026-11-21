import type { JSX } from 'react';
import { ScrollView } from 'react-native';
import { Button, Text } from '@tallyui/components';
import type { CatalogueEntry } from '@tallyui/pos';
import { resolvePrice, type ProductTraits } from '@tallyui/core';
import { useFormatStoreMoney } from '../lib/money/store-money';
import { VariationPicker } from './variation-picker';

const stockLabels = { in_stock: 'In stock', out_of_stock: 'Out of stock', backorder: 'Backorder', unknown: 'Stock unknown' };

export function VariantChooser({ entries, currency, traits, onSelect, onClose }: {
  entries: CatalogueEntry<any>[]; currency: string; traits: ProductTraits<any>; onSelect(entry: CatalogueEntry<any>): void; onClose(): void;
}): JSX.Element {
  const formatMoney = useFormatStoreMoney();
  // @tallyui/pos' variantPriceLabel is resolvePrice + Intl; the same price in the store's format.
  const priceOf = (entry: CatalogueEntry<any>) => {
    const resolved = resolvePrice(entry.variant.prices, currency);
    return resolved ? formatMoney(resolved.current) : undefined;
  };
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
          <Text>{priceOf(entry)}</Text>
          <Text>{`${stockLabels[entry.variant.stock.status]}${entry.variant.stock.quantity === undefined ? '' : ` · ${entry.variant.stock.quantity}`}`}</Text>
        </Button>
      ))}
      <Button onPress={onClose}><Text>Cancel</Text></Button>
    </ScrollView>
  );
}
