import type { StockLevel, VariantOptionGroup, VariantSummary } from '@tallyui/core';

export interface PickerGroupState {
  name: string;
  values: string[];
  /** Per value, how many variants accept it alongside the cashier's other choices; {} when the cashier chose this group. */
  counts: Record<string, number>;
  /** The cashier's value, else the sole value with a count above zero. */
  selected?: string;
}

export interface PickerState {
  groups: PickerGroupState[];
  /** The cashier's choices plus the auto-selected values, group name to value. */
  selection: Record<string, string>;
  /** The variants that accept every one of the cashier's choices (auto-selected values are not applied). */
  matches: VariantSummary[];
}

/** True when the variant names `value` for group `name`, or leaves that group open ("Any"). */
export function variantAccepts(variant: VariantSummary, name: string, value: string): boolean {
  return variant.options?.[name] === undefined || variant.options[name] === value;
}

/** WCPOS v2's parseAttributes: per-value counts against the cashier's choices, and a sole viable value auto-selects. */
export function pickerState(
  groups: VariantOptionGroup[],
  variants: VariantSummary[],
  chosen: Record<string, string>,
): PickerState {
  const compatible = (variant: VariantSummary) =>
    Object.entries(chosen).every(([name, value]) => variantAccepts(variant, name, value));
  const matches = variants.filter(compatible);
  const selection: Record<string, string> = { ...chosen };
  const states = groups.map((group): PickerGroupState => {
    const own = chosen[group.name];
    if (own !== undefined) return { name: group.name, values: group.values, counts: {}, selected: own };
    const counts: Record<string, number> = {};
    for (const value of group.values) {
      counts[value] = variants.filter(variant => variantAccepts(variant, group.name, value) && compatible(variant)).length;
    }
    const viable = group.values.filter(value => counts[value] > 0);
    const selected = viable.length === 1 ? viable[0] : undefined;
    if (selected !== undefined) selection[group.name] = selected;
    return { name: group.name, values: group.values, counts, selected };
  });
  return { groups: states, selection, matches };
}

/** The cashier's values for the local (id-less) groups the variant leaves open; undefined when there are none. */
export function anyPicks(
  groups: VariantOptionGroup[],
  variant: VariantSummary,
  selection: Record<string, string>,
): Record<string, string> | undefined {
  const picks: Record<string, string> = {};
  for (const group of groups) {
    const value = selection[group.name];
    if (group.id === undefined && !(variant.options && group.name in variant.options)
      && typeof value === 'string' && group.values.includes(value)) picks[group.name] = value;
  }
  return Object.keys(picks).length ? picks : undefined;
}

/** v2's variation stock badge text, or null when the badge is hidden. */
export function variationStockText(stock: StockLevel): string | null {
  if (stock.status === 'out_of_stock') return 'Out of Stock';
  if (stock.status === 'backorder') return 'On Backorder';
  return stock.quantity === undefined ? null : `${stock.quantity} in stock`;
}
