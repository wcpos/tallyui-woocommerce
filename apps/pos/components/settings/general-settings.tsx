import { useState, type JSX } from 'react';
import { Linking, View } from 'react-native';
import { Button, SettingsGroup, SettingsRow, Switch, Text } from '@tallyui/components';
import type { CustomerSummary } from '@tallyui/pos';
import type { CurrencyPosition, StoreInfo } from '../../lib/catalogue/store-info';
import type { CustomerSource } from '../../lib/customers/customer-source';
import type { DefaultCustomerSetting } from '../../lib/customers/default-customer';
import { CustomerPicker } from '../customer-picker';

export function wooSettingsUrl(siteHome: string): string {
  return `${siteHome.replace(/\/+$/, '')}/wp-admin/admin.php?page=wc-settings`;
}

export function LockedRow({ testID, label, value, href }: {
  testID: string; label: string; value: string | boolean | undefined; href: string;
}) {
  return (
    <SettingsRow testID={testID} label={label} action={
      <View className="flex-row items-center gap-3">
        {/* v2 PropertyRow: a locked boolean is a disabled switch, an empty locked value a dash. */}
        {typeof value === 'boolean'
          ? <Switch testID={`${testID}-switch`} accessibilityLabel={label} checked={value} onCheckedChange={() => {}} disabled />
          : <Text testID={`${testID}-value`}>{value || '—'}</Text>}
        <Text className="text-xs text-muted-foreground">Set in WooCommerce</Text>
        <Button variant="link" size="sm" accessibilityRole="link" testID={`${testID}-open`}
          onPress={() => { void Linking.openURL(href); }}><Text>Open</Text></Button>
      </View>
    } />
  );
}

// v2 General: "<region name> (<CODE>)". The bare code when Intl has no name for it.
export function countryLabel(code: string | undefined): string | undefined {
  if (!code) return undefined;
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
    return name ? `${name} (${code})` : code;
  } catch {
    return code;
  }
}

// v2 settings.currency_pos options.
const POSITION_LABELS: Record<CurrencyPosition, string> = {
  left: 'Left', right: 'Right', left_space: 'Left with space', right_space: 'Right with space',
};

export interface DefaultCustomerControl {
  setting: DefaultCustomerSetting;
  /** The stored customer, looked up for its name: null is Guest, undefined while it resolves. */
  customer: CustomerSummary | null | undefined;
  source: CustomerSource | null;
  createBlockedReason?: string;
  onChange(next: DefaultCustomerSetting): void;
}

// v2 General's default_customer (a customer select with Guest) and default_customer_is_cashier, which disables it.
function DefaultCustomerRows({ setting, customer, source, onChange }: DefaultCustomerControl) {
  const [chosen, setChosen] = useState<CustomerSummary | null>();
  const shown = chosen !== undefined ? chosen : customer ?? null;
  function choose(next: CustomerSummary | null) {
    const id = next ? Number(next.id) : 0;
    setChosen(next);
    onChange({ ...setting, customerId: Number.isInteger(id) && id > 0 ? id : 0 });
  }
  return (
    <>
      <SettingsRow testID="settings-general-default_customer" label="Default Customer"
        description="Pre-selected on every new cart." action={source && !setting.isCashier
          ? <CustomerPicker source={source} customer={shown} onChange={choose} />
          : <Button variant="outline" size="sm" disabled testID="settings-general-default_customer-select">
            <Text>{shown ? shown.name : 'Guest'}</Text></Button>} />
      <SettingsRow testID="settings-general-default_customer_is_cashier" label="Default Customer is cashier" action={
        <Switch testID="settings-general-default_customer_is_cashier-switch" accessibilityLabel="Default Customer is cashier"
          checked={setting.isCashier} onCheckedChange={isCashier => onChange({ ...setting, isCashier })} />
      } />
    </>
  );
}

export function GeneralSettings(props: {
  store: StoreInfo; siteHome: string; defaultCustomer?: DefaultCustomerControl;
}): JSX.Element {
  const href = wooSettingsUrl(props.siteHome);
  const address = props.store.address;
  const format = props.store.numberFormat;
  return (
    <View testID="screen-settings-general" className="gap-5">
      <SettingsGroup title="Store" testID="settings-general-store">
        <LockedRow testID="settings-general-locked-name" label="Store Name" value={props.store.name} href={href} />
        <LockedRow testID="settings-general-locked-store_country" label="Store Base Country" value={countryLabel(address?.country)} href={href} />
        {/* v2 names the state; the app shows WooCommerce's code as sent. */}
        <LockedRow testID="settings-general-locked-store_state" label="Store Base State" value={address?.state} href={href} />
        <LockedRow testID="settings-general-locked-store_city" label="Store Base City" value={address?.city} href={href} />
        <LockedRow testID="settings-general-locked-store_postcode" label="Store Base Postcode" value={address?.postcode} href={href} />
      </SettingsGroup>
      <SettingsGroup title="Localization" testID="settings-general-localization">
        <LockedRow testID="settings-general-locked-locale" label="Language" value={props.store.locale} href={href} />
        {props.defaultCustomer ? <DefaultCustomerRows {...props.defaultCustomer} /> : null}
      </SettingsGroup>
      {/* Locked: @tallyui/components formats cart money from the locale only, so an edited format would not reach
          the cart. v2's order; an empty thousand separator (no grouping) reads as a dash. */}
      <SettingsGroup title="Currency & numbers" testID="settings-general-currency">
        <LockedRow testID="settings-general-locked-currency" label="Currency" value={props.store.currency} href={href} />
        <LockedRow testID="settings-general-locked-currency_pos" label="Currency Position"
          value={format?.position && POSITION_LABELS[format.position]} href={href} />
        <LockedRow testID="settings-general-locked-price_decimal_sep" label="Decimal Separator" value={format?.decimalSeparator} href={href} />
        <LockedRow testID="settings-general-locked-price_num_decimals" label="Number of Decimals"
          value={format?.decimals === undefined ? undefined : String(format.decimals)} href={href} />
        <LockedRow testID="settings-general-locked-price_thousand_sep" label="Thousand Separator" value={format?.thousandSeparator} href={href} />
      </SettingsGroup>
    </View>
  );
}
