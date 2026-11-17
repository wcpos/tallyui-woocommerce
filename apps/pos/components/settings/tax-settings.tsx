import { useState, type JSX } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import type { StoreSettings } from '@tallyui/core';
import type { StoreInfo, TaxBasedOn } from '../../lib/catalogue/store-info';
import { Segmented } from '../segmented';
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

const TAX_TOTAL_SEGMENTS = [
  { value: 'single', label: 'As a single total' }, { value: 'itemized', label: 'Itemized' },
];
const INCL_EXCL_SEGMENTS = [
  { value: 'incl', label: 'Including tax' }, { value: 'excl', label: 'Excluding tax' },
];

// v2 tax.tsx:185-225 edits these per POS store; here they are WooCommerce's own options, so each row
// is locked like Calculation's, its choice drawn in v2's two-way segments, disabled.
// self-stretch fills the 320 value column as v2's segments do.
function LockedSegments({ testID, label, value, segments, href }: {
  testID: string; label: string; value: string | undefined; segments: { value: string; label: string }[]; href: string;
}) {
  return <LockedRow testID={testID} label={label} href={href} value={undefined} control={value === undefined ? undefined :
    <View className="self-stretch"><Segmented testID={`${testID}-segments`} label={label} value={value}
      segments={segments.map(segment => ({ ...segment, disabled: true }))} onChange={() => {}} /></View>} />;
}

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
  store?: Pick<StoreInfo, 'taxBasedOn' | 'calcTaxes' | 'taxTotalDisplay' | 'taxDisplayShop' | 'taxDisplayCart' | 'priceDisplaySuffix'>;
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
      <SettingsSection title="Display" testID="settings-tax-display">
        <LockedSegments testID="settings-tax-locked-tax_total_display" label="Display Tax Totals"
          value={props.store?.taxTotalDisplay} segments={TAX_TOTAL_SEGMENTS} href={href} />
        <LockedSegments testID="settings-tax-locked-tax_display_shop" label="Display Prices in the Shop"
          value={props.store?.taxDisplayShop} segments={INCL_EXCL_SEGMENTS} href={href} />
        <LockedSegments testID="settings-tax-locked-tax_display_cart" label="Display Prices During Cart and Checkout"
          value={props.store?.taxDisplayCart} segments={INCL_EXCL_SEGMENTS} href={href} />
        <LockedRow testID="settings-tax-locked-price_display_suffix" label="Price Display Suffix" value={props.store?.priceDisplaySuffix} href={href} />
      </SettingsSection>
      <TaxRates settings={props.settings} />
    </View>
  );
}
