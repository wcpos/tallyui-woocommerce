// v2's ProductAttributes and VariationsButton (WCPOS monorepo
// `packages/core/src/screens/main/components/product/attributes.tsx`), read-only, in the drill style the Products
// page opens with (`variationsStyle` 'drill'): one row per attribute with `variation: true`, `Name: ` in help text
// then each option as a primary-tone link (a press drills in with that option as the match), then a ghost button
// "N variations" with a chevron after it (a press drills in). Strings are core.json's `products.n_variations`.
import type { JSX } from 'react';
import { Fragment } from 'react';
import { View } from 'react-native';
import { Path } from 'react-native-svg';
import { Button, createSvgIcon, Text } from '@tallyui/components';

// lucide `chevron-right`, v2's `chevronRight`, as browse-terms-view.tsx draws it.
const ChevronRightIcon = createSvgIcon('ChevronRightIcon', () => <Path d="m9 18 6-6-6-6" />);

export interface ProductAttribute {
  id?: number;
  name: string;
  position?: number;
  visible?: boolean;
  variation?: boolean;
  options?: string[];
}

/** One variation of the product doc's `variation_docs`, as the connector embeds it. */
export interface VariationDoc {
  id: number;
  name?: string;
  sku?: string;
  barcode?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  manage_stock?: boolean;
  stock_quantity?: number | null;
  stock_status?: string;
  status?: string;
  attributes?: { name: string; option: string }[];
}

/** v2's VariationMatch, by attribute name: the connector's variation attributes carry no id. */
export interface VariationMatch { name: string; option: string }

/** v2's `products.n_variations`: "{count} variation" / "{count} variations". */
export function variationsLabel(count: number): string {
  return count === 1 ? '1 variation' : `${count.toLocaleString()} variations`;
}

/** v2's variationAllMatch for one criterion: a variation without that attribute ("Any") matches, else the option must. */
export function variationMatches(variation: VariationDoc, match: VariationMatch | undefined): boolean {
  if (!match) return true;
  const own = variation.attributes?.find(attribute => attribute.name === match.name);
  return own === undefined || own.option === match.option;
}

/** v2's resolveVariationName (cells/variation-name.tsx): the variation's own options, else its name. */
export function variationName(variation: VariationDoc, fallback: string): string {
  const options = (variation.attributes ?? []).map(attribute => attribute.option?.trim()).filter(Boolean);
  return options.length ? options.join(', ') : variation.name ?? fallback;
}

export function ProductAttributes({ id, attributes, count, onDrill }: {
  id: number;
  attributes: ProductAttribute[] | undefined;
  count: number;
  onDrill(match?: VariationMatch): void;
}): JSX.Element {
  const rows = (attributes ?? []).filter(attribute => attribute.variation);
  return (
    <View className="gap-1">
      {rows.map(attribute => (
        <Text key={attribute.name} testID={`product-attributes-${id}-${attribute.name}`} className="text-xs">
          <Text className="text-xs text-muted-foreground">{`${attribute.name}: `}</Text>
          {(attribute.options ?? []).map((option, index) => (
            <Fragment key={option}>
              {index > 0 ? ', ' : null}
              <Text testID={`product-attribute-${id}-${attribute.name}-${option}`} role="link"
                className="text-xs text-primary web:hover:underline"
                onPress={() => onDrill({ name: attribute.name, option })}>
                {option}
              </Text>
            </Fragment>
          ))}
        </Text>
      ))}
      <Button testID="variable-product-expand" variant="ghost" size="sm" className="max-w-full flex-row self-start px-0"
        onPress={() => onDrill()}>
        <Text testID={`product-variations-${id}`}>{variationsLabel(count)}</Text>
        <View testID={`product-variations-chevron-${id}`}><ChevronRightIcon size={14} /></View>
      </Button>
    </View>
  );
}
