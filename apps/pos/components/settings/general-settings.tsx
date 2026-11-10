import type { JSX } from 'react';
import { Linking, View } from 'react-native';
import { Button, SettingsGroup, SettingsRow, Text } from '@tallyui/components';
import type { StoreInfo } from '../../lib/catalogue/store-info';

export function wooSettingsUrl(siteHome: string): string {
  return `${siteHome.replace(/\/+$/, '')}/wp-admin/admin.php?page=wc-settings`;
}

function LockedRow({ testID, label, value, href }: {
  testID: string; label: string; value: string | undefined; href: string;
}) {
  return (
    <SettingsRow testID={testID} label={label} action={
      <View className="flex-row items-center gap-3">
        <Text testID={`${testID}-value`}>{value || '—'}</Text>
        <Text className="text-xs text-muted-foreground">Set in WooCommerce</Text>
        <Button variant="link" size="sm" accessibilityRole="link" testID={`${testID}-open`}
          onPress={() => { void Linking.openURL(href); }}><Text>Open</Text></Button>
      </View>
    } />
  );
}

export function GeneralSettings(props: { store: StoreInfo; siteHome: string }): JSX.Element {
  const href = wooSettingsUrl(props.siteHome);
  return (
    <View testID="screen-settings-general" className="gap-5">
      <Text className="text-2xl font-semibold">General</Text>
      <SettingsGroup title="Store" testID="settings-general-store">
        <LockedRow testID="settings-general-locked-name" label="Store Name" value={props.store.name} href={href} />
        <LockedRow testID="settings-general-locked-currency" label="Currency" value={props.store.currency} href={href} />
        <LockedRow testID="settings-general-locked-locale" label="Language" value={props.store.locale} href={href} />
      </SettingsGroup>
    </View>
  );
}
