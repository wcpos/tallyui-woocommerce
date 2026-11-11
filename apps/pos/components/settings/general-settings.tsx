import type { JSX } from 'react';
import { Linking, View } from 'react-native';
import { Button, SettingsGroup, SettingsRow, Switch, Text } from '@tallyui/components';
import type { StoreInfo } from '../../lib/catalogue/store-info';

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

export function GeneralSettings(props: { store: StoreInfo; siteHome: string }): JSX.Element {
  const href = wooSettingsUrl(props.siteHome);
  const address = props.store.address;
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
      </SettingsGroup>
      <SettingsGroup title="Currency & numbers" testID="settings-general-currency">
        <LockedRow testID="settings-general-locked-currency" label="Currency" value={props.store.currency} href={href} />
      </SettingsGroup>
    </View>
  );
}
