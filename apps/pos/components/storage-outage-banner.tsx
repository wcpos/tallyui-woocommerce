import type { JSX } from 'react';
import { Platform, View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import { toast } from '../lib/toast/toast';

/** v2 storage-outage-banner.tsx:24-65. Keep its copy: the outbox shares the catalogue database. */
export function StorageOutageBanner({ degraded, onViewStatus }: { degraded: boolean; onViewStatus?: () => void }): JSX.Element | null {
  if (!degraded) return null;
  return (
    <View testID="storage-outage-banner" role="alert" aria-live="assertive"
      className="flex-row flex-wrap items-center gap-2 rounded-lg border border-destructive/45 bg-destructive/10 px-3 py-2.5">
      <Text testID="storage-outage-banner-title" className="min-w-0 flex-1 basis-48 font-medium text-foreground">
        Local database unavailable — scanning, checkout, saving and voiding are blocked until the app is reloaded.</Text>
      <View className="flex-row flex-wrap gap-2">
        <Button testID="storage-outage-reload" variant="ghost" size="sm" onPress={() => {
          if (Platform.OS === 'web') window.location.reload();
          else toast({ type: 'error', title: "This build can't reload itself — close the app completely and open it again." });
        }}><Text>Reload the app</Text></Button>
        {onViewStatus && <Button testID="scan-outage-view-status" variant="ghost" size="sm" onPress={onViewStatus}>
          <Text>View status</Text></Button>}
      </View>
    </View>
  );
}
