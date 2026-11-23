import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import type { StoreSettings } from '@tallyui/core';
import type { StoreSettingsState } from '@tallyui/pos';
import { storeDecimalsMismatch } from '../lib/sale/store-decimals';

const decimalsWord = (n: number) => `${n} ${n === 1 ? 'decimal' : 'decimals'}`;

export function StoreSettingsGate({ store, children }: {
  store: StoreSettingsState; children: (settings: StoreSettings) => ReactNode;
}) {
  if (store.state === 'ready') {
    const mismatch = storeDecimalsMismatch(store.settings);
    if (mismatch === null) return children(store.settings);
    const { storeDecimals, currencyDigits } = mismatch;
    return (
      <View testID="store-decimals-block" className="flex-1 items-center justify-center bg-background p-6">
        <Text>{`This store rounds prices to ${decimalsWord(storeDecimals)}, but ${store.settings.currency} needs ${currencyDigits}. The till can't sell until the store matches.`}</Text>
        <Text>{`In WooCommerce, go to Settings › General › Currency options and set Number of decimals to ${currencyDigits}.`}</Text>
        <Button testID="store-decimals-check-again" disabled={store.refreshing === true} onPress={store.refresh}>
          <Text>{store.refreshing ? 'Checking…' : 'Check again'}</Text>
        </Button>
      </View>
    );
  }
  const message = store.state === 'loading' ? "Loading the store's tax settings…"
    : store.state === 'error' ? store.nextRetryAt !== undefined
      ? "Can't reach the store's settings yet. Retrying…" : "Could not load the store's tax settings."
    : "This store's tax settings aren't supported, so the till cannot sell.";
  return (
    <View className="flex-1 items-center justify-center bg-background p-6">
      <Text>{message}</Text>
      {store.state === 'error' && store.nextRetryAt === undefined
        ? <Button onPress={store.retry}><Text>Retry</Text></Button> : null}
    </View>
  );
}
