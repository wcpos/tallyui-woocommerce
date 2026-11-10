import type { JSX } from 'react';
import { View } from 'react-native';
import { SettingsGroup } from '@tallyui/components';
import type { StoreSettings } from '@tallyui/core';
import { LockedRow, wooSettingsUrl } from './general-settings';

export function wooTaxSettingsUrl(siteHome: string): string {
  return `${wooSettingsUrl(siteHome)}&tab=tax`;
}

// v2 settings/tax.tsx: 'inherit' is WooCommerce's "based on cart items" sentinel and '' the standard
// class. The app has no class names, so other slugs are named as lib/sale/tax-classes.ts names them.
export function shippingTaxClassLabel(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value === 'inherit') return 'Based on cart items';
  if (value === '' || value === 'standard') return 'Standard rate';
  return value.replace(/-/g, ' ').replace(/^./, letter => letter.toUpperCase());
}

export function TaxSettings(props: {
  settings: Pick<StoreSettings, 'pricesIncludeTax' | 'taxRoundAtSubtotal' | 'shippingTaxClass'>;
  siteHome: string;
}): JSX.Element {
  const href = wooTaxSettingsUrl(props.siteHome);
  return (
    <View testID="screen-settings-tax" className="gap-5">
      <SettingsGroup title="Calculation" testID="settings-tax-calculation">
        <LockedRow testID="settings-tax-locked-prices_include_tax" label="Prices entered with tax" value={props.settings.pricesIncludeTax} href={href} />
        <LockedRow testID="settings-tax-locked-shipping_tax_class" label="Shipping tax class" value={shippingTaxClassLabel(props.settings.shippingTaxClass)} href={href} />
        <LockedRow testID="settings-tax-locked-tax_round_at_subtotal" label="Round tax at subtotal level" value={props.settings.taxRoundAtSubtotal === true} href={href} />
      </SettingsGroup>
    </View>
  );
}
