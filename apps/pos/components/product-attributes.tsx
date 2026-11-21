// v2's ProductAttributes and VariationsButton (WCPOS monorepo
// `packages/core/src/screens/main/components/product/attributes.tsx`), read-only, in the drill style the Products
// page opens with (`variationsStyle` 'drill'): one row per attribute with `variation: true`, `Name: ` in help text
// then each option as a primary-tone link (a press drills in with that option as the match), then a ghost button
// "N variations" with a trailing chevron, or a leading expand chevron in inline style. Strings are core.json's `products.n_variations`.
import type { JSX } from 'react';
import { Fragment } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import { ChevronDownIcon, ChevronRightIcon } from './icons';

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

/** v2's childrenSearchCount: the variants whose SKU or barcode contains the trimmed term, ignoring case; 0 without a term. */
export function variationsFoundFor(variants: ReadonlyArray<{ sku?: string; barcode?: string }>, term: string): number {
  const search = term.trim().toLowerCase();
  if (!search) return 0;
  return variants.filter(variant => variant.sku?.toLowerCase().includes(search) || variant.barcode?.toLowerCase().includes(search)).length;
}

/** v2's `common.variation_found_for_term`: '1 variation found for "ABC"' / '2 variations found for "ABC"'. */
export function variationsFoundLabel(count: number, term: string): string {
  return `${variationsLabel(count)} found for "${term}"`;
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

/** One attribute row: `Name: ` in v2's help text, then its options in text-xs, joined with ", "; each option is a
 *  primary-tone link when `onOption` is given (ProductAttributes), plain text otherwise (PlainAttributes). */
function AttributeRow({ id, testID, attribute, onOption }: {
  id: number; testID: string; attribute: ProductAttribute; onOption?(match: VariationMatch): void;
}): JSX.Element {
  return (
    <Text testID={testID} className="text-xs">
      <Text className="text-xs text-muted-foreground">{`${attribute.name}: `}</Text>
      {onOption ? (attribute.options ?? []).map((option, index) => (
        <Fragment key={option}>
          {index > 0 ? ', ' : null}
          <Text testID={`product-attribute-${id}-${attribute.name}-${option}`} role="link"
            className="text-xs text-primary web:hover:underline"
            onPress={() => onOption({ name: attribute.name, option })}>
            {option}
          </Text>
        </Fragment>
      )) : (attribute.options ?? []).join(', ')}
    </Text>
  );
}

/** v2's PlainAttributes (components/product/attributes.tsx:21-47), the Product column's Attributes line: the
 *  attributes that make no variation, one row each; nothing when there are none. */
export function PlainAttributes({ id, attributes }: { id: number; attributes: ProductAttribute[] | undefined }): JSX.Element | null {
  const rows = (attributes ?? []).filter(attribute => attribute.variation !== true);
  return rows.length === 0 ? null : <View testID={`product-plain-attributes-${id}`}>
    {rows.map(attribute => <AttributeRow key={attribute.name} id={id} testID={`product-plain-attribute-${id}-${attribute.name}`} attribute={attribute} />)}
  </View>;
}

// `options` false is v2's phone row (products/row.tsx:178-205 VariableRowContent): the VariationsButton alone, no attribute rows.
export function ProductAttributes({ id, attributes, count, onDrill, options = true, expanded, found }: {
  id: number;
  attributes: ProductAttribute[] | undefined;
  count: number;
  onDrill(match?: VariationMatch): void;
  options?: boolean;
  expanded?: boolean;
  found?: { count: number; term: string };
}): JSX.Element {
  const rows = options ? (attributes ?? []).filter(attribute => attribute.variation) : [];
  return (
    <View className="gap-1">
      {rows.map(attribute => <AttributeRow key={attribute.name} id={id} testID={`product-attributes-${id}-${attribute.name}`}
        attribute={attribute} onOption={onDrill} />)}
      <Button testID="variable-product-expand" variant="ghost" size="sm" className="max-w-full shrink flex-row self-start px-0"
        {...(expanded === undefined ? {} : { 'aria-expanded': expanded, accessibilityState: { expanded } })}
        onPress={() => onDrill()}>
        {expanded !== undefined && <View testID={`product-variations-chevron-${id}`}>
          {expanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
        </View>}
        <Text testID={`product-variations-${id}`} numberOfLines={1} className="shrink">{found && found.count > 0 ? `${variationsLabel(count)} - ${variationsFoundLabel(found.count, found.term)}` : variationsLabel(count)}</Text>
        {expanded === undefined && <View testID={`product-variations-chevron-${id}`}><ChevronRightIcon size={14} /></View>}
      </Button>
    </View>
  );
}
