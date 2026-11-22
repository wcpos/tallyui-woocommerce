import { useState } from 'react';
import type { JSX } from 'react';
import { ScrollView, View } from 'react-native';
import { Badge, Button, ProductVariantPicker, Text } from '@tallyui/components';
import type { CatalogueEntry } from '@tallyui/pos';
import { resolvePrice, type ProductTraits, type VariantOptionGroup } from '@tallyui/core';
import { useFormatStoreMoney } from '../lib/money/store-money';
import { anyPicks, pickerState, variationStockText } from '../lib/catalogue/variation-match';
import { VariationSelect } from './variation-select';

/** WCPOS v2's variation picker: per attribute a row of values, or a select when they run long, then stock and Add once one variation matches. */
export function VariationPicker({ entries, groups, currency, traits, onSelect, onClose, variant = 'sheet' }: {
  entries: CatalogueEntry<any>[]; groups: VariantOptionGroup[]; currency: string; traits: ProductTraits<any>;
  onSelect(entry: CatalogueEntry<any>): void; onClose(): void; variant?: 'sheet' | 'popover';
}): JSX.Element {
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const state = pickerState(groups, entries.map(entry => entry.variant), chosen);
  const match = state.matches.length === 1 ? entries.find(entry => entry.variant.id === state.matches[0].id) : undefined;
  const stockText = match ? variationStockText(match.variant.stock) : null;
  const formatMoney = useFormatStoreMoney();
  // @tallyui/pos' variantPriceLabel is resolvePrice + Intl; the same price in the store's format, as the tile reads it.
  const resolved = match ? resolvePrice(match.variant.prices, currency) : undefined;
  const price = resolved ? formatMoney(resolved.current) : undefined;

  function choose(name: string, value: string | undefined) {
    // Only the cashier's own press becomes a choice; auto-selected values stay display only.
    if (value !== undefined && value !== state.selection[name]) setChosen(current => ({ ...current, [name]: value }));
  }

  function add() {
    if (!match) return;
    const picks = anyPicks(groups, match.variant, state.selection);
    onSelect(picks ? { ...match, picks } : match);
  }

  const body = <>
      <View testID="variation-popover-options" className="mt-3 gap-3">
        {state.groups.map(group => group.values.join('').length < 15 ? (
          // v2's characterCount rule (utils.ts:118, variations.tsx:165): short values are buttons, long ones a select.
          <ProductVariantPicker key={group.name} options={[{ name: group.name, values: group.values }]}
            selected={state.selection} onSelect={next => choose(group.name, next[group.name])} />
        ) : (
          <View key={group.name} className="gap-1.5">
            <Text className="text-xs font-semibold text-muted-foreground">{group.name}</Text>
            <VariationSelect group={group} selected={state.selection[group.name]} onSelect={value => choose(group.name, value)} />
          </View>
        ))}
      </View>
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
  </>;
  // v2's popover body (cells/variations-popover/variations.tsx:146): a bare `min-w-52 shrink` stack, no title or Cancel.
  if (variant === 'popover') return <View testID="variation-picker" className="min-w-52 shrink">{body}</View>;

  return (
    <ScrollView className="flex-1 bg-background p-4" testID="variation-picker">
      <Text className="text-lg font-semibold">{traits.getName(entries[0].product)}</Text>
      {body}
      <Button variant="ghost" className="mt-4" onPress={onClose}><Text>Cancel</Text></Button>
    </ScrollView>
  );
}
