import type { JSX } from 'react';
import { View } from 'react-native';
import { SettingsGroup, SettingsRow, Text } from '@tallyui/components';
import type { StoreSettings } from '@tallyui/core';
import type { StoreInfo, TaxBasedOn } from '../../lib/catalogue/store-info';
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

const TAX_BASED_ON_LABELS: Record<TaxBasedOn, string> = {
  base: 'Shop base address', billing: 'Customer billing address', shipping: 'Customer shipping address',
};

type TaxRate = NonNullable<StoreSettings['taxRates']>[string][number];

// WooCommerce sends rates as 4-decimal strings: "10.0000" reads 10%, "8.2500" 8.25%.
export function ratePercent(rate: string): string {
  const trimmed = rate.includes('.') ? rate.replace(/0+$/, '').replace(/\.$/, '') : rate;
  return `${trimmed}%`;
}

// v2 tax-rates/rate-rows.ts rateTags, then phoneTags' priority when it is not WooCommerce's default 1.
export function rateTags(rate: Pick<TaxRate, 'compound' | 'shipping' | 'priority'>): string {
  return [
    rate.compound ? 'Compound' : null,
    rate.shipping === false ? 'Not on shipping' : null,
    rate.priority !== 1 ? `Priority ${rate.priority}` : null,
  ].filter(Boolean).join(' · ');
}

function TaxRates({ taxRates }: { taxRates: StoreSettings['taxRates'] }) {
  const classes = Object.entries(taxRates ?? {}).filter(([, rates]) => rates.length > 0);
  const note = 'px-4 py-3 text-xs text-muted-foreground';
  return (
    <SettingsGroup title="Tax Rates" testID="settings-tax-rates">
      {classes.length === 0
        ? <Text className={note} testID="settings-tax-rates-empty">No tax rates apply at the store's address.</Text>
        : <>
          {classes.map(([taxClass, rates]) => (
            <View key={taxClass} testID={`settings-tax-rates-class-${taxClass || 'standard'}`}>
              <Text className="px-4 pt-3 text-xs font-semibold text-muted-foreground">{shippingTaxClassLabel(taxClass)}</Text>
              {rates.map(rate => (
                <SettingsRow key={rate.id} testID={`settings-tax-rate-${rate.id}`} label={rate.label}
                  description={rateTags(rate) || undefined}
                  action={<Text testID={`settings-tax-rate-${rate.id}-rate`}>{ratePercent(rate.rate)}</Text>} />
              ))}
            </View>
          ))}
          <Text className={note} testID="settings-tax-rates-note">The rates that apply at the store's address.</Text>
        </>}
    </SettingsGroup>
  );
}

export function TaxSettings(props: {
  settings: Pick<StoreSettings, 'pricesIncludeTax' | 'taxRoundAtSubtotal' | 'shippingTaxClass' | 'taxRates'>;
  store?: Pick<StoreInfo, 'taxBasedOn' | 'calcTaxes'>;
  siteHome: string;
}): JSX.Element {
  const href = wooTaxSettingsUrl(props.siteHome);
  const taxBasedOn = props.store?.taxBasedOn;
  return (
    <View testID="screen-settings-tax" className="gap-5">
      <SettingsGroup title="Calculation" testID="settings-tax-calculation">
        <LockedRow testID="settings-tax-locked-tax_based_on" label="Calculate tax based on" value={taxBasedOn && TAX_BASED_ON_LABELS[taxBasedOn]} href={href} />
        {/* A locked switch; before the catalogue is up the store has not said, so the row reads the dash. */}
        <LockedRow testID="settings-tax-locked-calc_taxes" label="Enable Taxes" value={props.store?.calcTaxes} href={href} />
        <LockedRow testID="settings-tax-locked-prices_include_tax" label="Prices Entered with Tax" value={props.settings.pricesIncludeTax} href={href} />
        <LockedRow testID="settings-tax-locked-shipping_tax_class" label="Shipping Tax Class" value={shippingTaxClassLabel(props.settings.shippingTaxClass)} href={href} />
        <LockedRow testID="settings-tax-locked-tax_round_at_subtotal" label="Round Tax at Subtotal Level" value={props.settings.taxRoundAtSubtotal === true} href={href} />
      </SettingsGroup>
      <TaxRates taxRates={props.settings.taxRates} />
    </View>
  );
}
