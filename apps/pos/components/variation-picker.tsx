import { useState } from 'react';
import type { JSX } from 'react';
import { ScrollView, View } from 'react-native';
import { Badge, Button, ProductVariantPicker, Text } from '@tallyui/components';
import { variantPriceLabel } from '@tallyui/pos';
import type { CatalogueEntry } from '@tallyui/pos';
import type { ProductTraits, VariantOptionGroup } from '@tallyui/core';
import { anyPicks, pickerState, variationStockText } from '../lib/catalogue/variation-match';

/** WCPOS v2's variation picker: one row of values per attribute, then stock and Add once one variation matches. */
export function VariationPicker({ entries, groups, currency, traits, onSelect, onClose }: {
  entries: CatalogueEntry<any>[]; groups: VariantOptionGroup[]; currency: string; traits: ProductTraits<any>;
  onSelect(entry: CatalogueEntry<any>): void; onClose(): void;
}): JSX.Element {
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const state = pickerState(groups, entries.map(entry => entry.variant), chosen);
  const match = state.matches.length === 1 ? entries.find(entry => entry.variant.id === state.matches[0].id) : undefined;
  const stockText = match ? variationStockText(match.variant.stock) : null;
  const price = match ? variantPriceLabel(match.variant, currency) : undefined;

  function add() {
    if (!match) return;
    const picks = anyPicks(groups, match.variant, state.selection);
    onSelect(picks ? { ...match, picks } : match);
  }

  return (
    <ScrollView className="flex-1 bg-background p-4" testID="variation-picker">
      <Text className="text-lg font-semibold">{traits.getName(entries[0].product)}</Text>
      <ProductVariantPicker testID="variation-popover-options" className="mt-3"
        options={groups.map(group => ({ name: group.name, values: group.values }))}
        selected={state.selection}
        onSelect={next => {
          // Only the cashier's own press becomes a choice; auto-selected values stay display only.
          const key = Object.keys(next).find(name => next[name] !== state.selection[name]);
          if (key !== undefined) setChosen(current => ({ ...current, [key]: next[key] }));
        }} />
      {match ? (
        <View className="mt-4 gap-2">
          {stockText !== null && (
            <Badge testID="variation-popover-stock-badge" className="self-start" label={stockText}
              variant={match.variant.stock.status === 'out_of_stock' ? 'destructive'
                : match.variant.stock.status === 'backorder' ? 'warning' : 'success'} />
          )}
          <Button testID="variation-popover-add-to-cart" onPress={add}>
            <Text>{price ? `Add to Cart: ${price}` : 'Add to Cart'}</Text>
          </Button>
        </View>
      ) : state.matches.length === 0 ? (
        <Text testID="variation-popover-unavailable" className="mt-4 text-muted-foreground">Variant not available</Text>
      ) : null}
      <Button variant="ghost" className="mt-4" onPress={onClose}><Text>Cancel</Text></Button>
    </ScrollView>
  );
}
