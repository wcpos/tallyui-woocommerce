import { useState, type JSX, type ReactNode } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Button, Switch, Text } from '@tallyui/components';
import type { CustomerSummary } from '@tallyui/pos';
import type { CurrencyPosition, StoreInfo } from '../../lib/catalogue/store-info';
import type { CustomerSource } from '../../lib/customers/customer-source';
import { clearDefaultCustomerSetting, type DefaultCustomerSetting } from '../../lib/customers/default-customer';
import { useRegister } from '../../lib/register/register-context';
import { wooCountryName, wooStateName } from '../../lib/settings/woo-regions';
import { CUSTOMER_SELECT_FACE, CustomerPicker, CustomerSelectFace } from '../customer-picker';
import { OpenExternalIcon } from '../docs-link';
import { RegisterSwitch } from '../register-controls';
import { ClearLocalData } from './clear-local-data';
import { RestoreServerSettings } from './restore-server-settings';
import { SavedFieldProvider, savedKeys, SETTINGS_KEY_CLASS, SettingsField, SettingsSection, useMarkSaved } from './settings-form';

export function wooSettingsUrl(siteHome: string): string {
  return `${siteHome.replace(/\/+$/, '')}/wp-admin/admin.php?page=wc-settings`;
}

export function LockedRow({ testID, label, value, href, control }: {
  testID: string; label: string; value: string | boolean | undefined; href: string; control?: ReactNode;
}) {
  // v2 property-row/index.tsx:114-118: the trailing slot is where it is set, in the key rank, then Open.
  return (
    <SettingsField testID={testID} label={label} trailing={<>
      <Text className={SETTINGS_KEY_CLASS}>Set in WooCommerce</Text>
      <Button variant="link" size="sm" accessibilityRole="link" testID={`${testID}-open`}
        onPress={() => { void Linking.openURL(href); }}>
        {/* v2 docs-link/index.tsx:38-47: "Open", then the ↗ at Icon size `xs` (icon/index.tsx:28, size-3.5: 14) in an xs (gap-1) HStack. */}
        <View className="flex-row items-center gap-1">
          <Text>Open</Text>
          <OpenExternalIcon testID={`${testID}-open-icon`} size={14} strokeWidth={1.5} className="text-primary" />
        </View>
      </Button>
    </>}>
      {/* v2 PropertyRow (l.125-135): a locked boolean is a disabled switch, an empty locked value a dash. */}
      {control !== undefined ? control : typeof value === 'boolean'
        ? <Switch size="sm" testID={`${testID}-switch`} accessibilityLabel={label} checked={value} onCheckedChange={() => {}} disabled />
        : <Text testID={`${testID}-value`}>{value || '—'}</Text>}
    </SettingsField>
  );
}

// v2's Language select (general.tsx:288-293, language-select.tsx:23-30) shows the language's name: "English (US)"
// for en-US, as the demo reads (`short` + `standard`; the default answers "American English"). The bare code when Intl
// has no DisplayNames or rejects the tag (a WordPress `en_US`).
export function languageLabel(locale: string | undefined): string | undefined {
  if (!locale) return undefined;
  try {
    return new Intl.DisplayNames([locale], { type: 'language', style: 'short', languageDisplay: 'standard' }).of(locale) || locale;
  } catch {
    return locale;
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
  const name = shown ? shown.name : 'Guest';
  // v2 general.tsx:178-182: after a write, mark the v2 keys it really changed; choosing the stored customer marks nothing.
  const markSaved = useMarkSaved();
  function choose(next: CustomerSummary | null) {
    const id = next ? Number(next.id) : 0;
    const customerId = Number.isInteger(id) && id > 0 ? id : 0;
    setChosen(next);
    onChange({ ...setting, customerId });
    markSaved(savedKeys({ default_customer: setting.customerId }, { default_customer: customerId }));
  }
  return (
    <>
      {/* v2 general.tsx:302-316: the help line under the key, the select in the value column. */}
      <SettingsField name="default_customer" testID="settings-general-default_customer" label="Default Customer"
        help="Pre-selected on every new cart.">
        {source && !setting.isCashier
          ? <CustomerPicker face="select" label="Default Customer" testID="settings-general-default_customer-select"
            source={source} customer={shown} onChange={choose} />
          // v2 combobox.tsx:105: disabled triggers use web:cursor-not-allowed opacity-45.
          : <Pressable disabled accessibilityRole="button" accessibilityLabel={`Default Customer: ${name}`}
            testID="settings-general-default_customer-select" className={`${CUSTOMER_SELECT_FACE} opacity-45 web:cursor-not-allowed`}>
            <CustomerSelectFace name={name} testID="settings-general-default_customer-select" />
          </Pressable>}
      </SettingsField>
      {/* v2 general.tsx:324-328: a control with no value is the value (property-row/index.tsx:143). */}
      {/* v2 core.json:1744 reads "Default Customer is cashier"; the demo's "Cashier" wins. */}
      <SettingsField name="default_customer_is_cashier" testID="settings-general-default_customer_is_cashier" label="Default Customer is Cashier">
        <Switch size="sm" testID="settings-general-default_customer_is_cashier-switch" accessibilityLabel="Default Customer is Cashier"
          checked={setting.isCashier} onCheckedChange={isCashier => {
            onChange({ ...setting, isCashier });
            markSaved(savedKeys({ default_customer_is_cashier: setting.isCashier }, { default_customer_is_cashier: isCashier }));
          }} />
      </SettingsField>
    </>
  );
}

export function GeneralSettings(props: {
  store: StoreInfo; siteHome: string; defaultCustomer?: DefaultCustomerControl;
}): JSX.Element {
  const href = wooSettingsUrl(props.siteHome);
  const address = props.store.address;
  const format = props.store.numberFormat;
  const register = useRegister();
  // A restore remounts the Default Customer rows, so a customer picked on this visit gives way to the store's.
  const [restores, setRestores] = useState(0);
  return (
    // v2 general.tsx:235-237: the sections stack in a gap-5 VStack, the first with no rule above it.
    <SavedFieldProvider><View testID="screen-settings-general" className="gap-5">
      <SettingsSection first title="Store" testID="settings-general-store">
        <LockedRow testID="settings-general-locked-name" label="Store Name" value={props.store.name} href={href} />
        <LockedRow testID="settings-general-locked-store_country" label="Store Base Country" value={wooCountryName(address?.country)} href={href} />
        {/* v2 general.tsx:247-265: WooCommerce's country and state names; the stored state code when it has none. */}
        <LockedRow testID="settings-general-locked-store_state" label="Store Base State" value={wooStateName(address?.country, address?.state)} href={href} />
        <LockedRow testID="settings-general-locked-store_city" label="Store Base City" value={address?.city} href={href} />
        <LockedRow testID="settings-general-locked-store_postcode" label="Store Base Postcode" value={address?.postcode} href={href} />
      </SettingsSection>
      <SettingsSection title="Localization" testID="settings-general-localization">
        <LockedRow testID="settings-general-locked-locale" label="Language" value={languageLabel(props.store.locale)} href={href} />
        {props.defaultCustomer ? <DefaultCustomerRows key={restores} {...props.defaultCustomer} /> : null}
      </SettingsSection>
      {/* Locked: @tallyui/components formats cart money from the locale only, so an edited format would not reach
          the cart. v2's order; an empty thousand separator (no grouping) reads as a dash. */}
      <SettingsSection title="Currency & numbers" testID="settings-general-currency">
        <LockedRow testID="settings-general-locked-currency" label="Currency" value={props.store.currency} href={href} />
        <LockedRow testID="settings-general-locked-currency_pos" label="Currency Position"
          value={format?.position && POSITION_LABELS[format.position]} href={href} />
        <LockedRow testID="settings-general-locked-price_decimal_sep" label="Decimal Separator" value={format?.decimalSeparator} href={href} />
        <LockedRow testID="settings-general-locked-price_num_decimals" label="Number of Decimals"
          value={format?.decimals === undefined ? undefined : String(format.decimals)} href={href} />
        <LockedRow testID="settings-general-locked-price_thousand_sep" label="Thousand Separator" value={format?.thousandSeparator} href={href} />
      </SettingsSection>
      {/* The same switch as Cart Settings, read from the one RegisterProvider at the root layout, so the two agree. It
          is here because a closed register replaces the cart, and Cart Settings with it. Open or closed, it shows. */}
      {register && <SettingsSection title="Register sessions" testID="settings-general-register"><RegisterSwitch inset={false} /></SettingsSection>}
      {/* v2 general.tsx:406-434: Restore server settings, then General ends with the local-data danger zone. */}
      <RestoreServerSettings restore={() => clearDefaultCustomerSetting(props.siteHome)} onRestored={() => setRestores(n => n + 1)} />
      <ClearLocalData />
    </View></SavedFieldProvider>
  );
}
