import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import type { StoreSettings } from '@tallyui/core';
import type { StoreSettingsState } from '@tallyui/pos';

export function StoreSettingsGate({ store, children }: {
  store: StoreSettingsState; children: (settings: StoreSettings) => ReactNode;
}) {
  if (store.state === 'ready') return children(store.settings);
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
