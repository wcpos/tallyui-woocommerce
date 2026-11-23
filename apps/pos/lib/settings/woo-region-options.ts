import { WOO_REGIONS } from './woo-regions';

// The countries/statesFor props for @tallyui's AddressFields/CustomerEditor, from the same data v2's country picker uses.
export const WOO_COUNTRY_OPTIONS: readonly { value: string; label: string }[] =
  Object.entries(WOO_REGIONS).map(([value, [label]]) => ({ value, label }));

const WOO_STATE_OPTIONS = Object.fromEntries(Object.entries(WOO_REGIONS).map(([country, [, states]]) =>
  [country, Object.entries(states).map(([value, label]) => ({ value, label }))]));

export function wooStatesFor(country: string): readonly { value: string; label: string }[] | undefined {
  const options = WOO_STATE_OPTIONS[country];
  return options?.length ? options : undefined;
}
