import { useState, type JSX } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import type { StoreSettings } from '@tallyui/core';
import type { StoreInfo, TaxBasedOn } from '../../lib/catalogue/store-info';
import { LockedRow, wooSettingsUrl } from './general-settings';
import { SettingsSection } from './settings-form';
import { TaxRatesDialog } from './tax-rates-dialog';

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

const TAX_BASED_ON_LABELS: Record<TaxBasedOn, string> = {
  base: 'Shop base address', billing: 'Customer billing address', shipping: 'Customer shipping address',
};

// v2 settings/tax.tsx:227-236: the section holds only the button; the rates are in the dialog it opens.
function TaxRates({ settings }: { settings: Pick<StoreSettings, 'allTaxRates' | 'taxClassSlugs'> }) {
  const [open, setOpen] = useState(false);
  return (
    <SettingsSection title="Tax Rates" testID="settings-tax-rates">
      <View className="flex-row py-2">
        <Button testID="settings-tax-view-all-rates" variant="outline" size="sm" onPress={() => setOpen(true)}>
          <Text>View all tax rates</Text>
        </Button>
      </View>
      {open && <TaxRatesDialog rates={settings.allTaxRates} taxClassSlugs={settings.taxClassSlugs} onClose={() => setOpen(false)} />}
    </SettingsSection>
  );
}

export function TaxSettings(props: {
  settings: Pick<StoreSettings, 'pricesIncludeTax' | 'taxRoundAtSubtotal' | 'shippingTaxClass' | 'allTaxRates' | 'taxClassSlugs'>;
  store?: Pick<StoreInfo, 'taxBasedOn' | 'calcTaxes'>;
  siteHome: string;
}): JSX.Element {
  const href = wooTaxSettingsUrl(props.siteHome);
  const taxBasedOn = props.store?.taxBasedOn;
  return (
    // v2 tax.tsx:137-139: sections in a gap-5 VStack, Calculation first with no rule above it.
    <View testID="screen-settings-tax" className="gap-5">
      <SettingsSection first title="Calculation" testID="settings-tax-calculation">
        <LockedRow testID="settings-tax-locked-tax_based_on" label="Calculate tax based on" value={taxBasedOn && TAX_BASED_ON_LABELS[taxBasedOn]} href={href} />
        {/* A locked switch; before the catalogue is up the store has not said, so the row reads the dash. */}
        <LockedRow testID="settings-tax-locked-calc_taxes" label="Enable Taxes" value={props.store?.calcTaxes} href={href} />
        <LockedRow testID="settings-tax-locked-prices_include_tax" label="Prices Entered with Tax" value={props.settings.pricesIncludeTax} href={href} />
        <LockedRow testID="settings-tax-locked-shipping_tax_class" label="Shipping Tax Class" value={shippingTaxClassLabel(props.settings.shippingTaxClass)} href={href} />
        <LockedRow testID="settings-tax-locked-tax_round_at_subtotal" label="Round Tax at Subtotal Level" value={props.settings.taxRoundAtSubtotal === true} href={href} />
      </SettingsSection>
      <TaxRates settings={props.settings} />
    </View>
  );
}
