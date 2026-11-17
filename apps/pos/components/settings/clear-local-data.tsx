import { useState, type JSX } from 'react';
import { View } from 'react-native';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Text,
} from '@tallyui/components';
import { describeResetConfirm, scheduleLocalDataReset, type UnsentChanges } from '../../lib/local-data-reset';
import { useIsWide } from '../../lib/layout/wide';
import { useOutbox } from '../../lib/sale/outbox-context';
import { toast } from '../../lib/toast/toast';
import { SETTINGS_HELP_CLASS } from './settings-form';

export function unsentChanges(outbox: ReturnType<typeof useOutbox>): UnsentChanges {
  if (!outbox.enabled || outbox.orders === null) return { status: 'unknown' };
  const count = outbox.state.pending + (outbox.state.rejected ?? 0);
  return count > 0 ? { status: 'unsent', count } : { status: 'none' };
}

export function ClearLocalData({
  schedule = () => scheduleLocalDataReset(), reload = () => globalThis.location?.reload(),
}: { schedule?: () => boolean; reload?: () => void }): JSX.Element {
  const wide = useIsWide();
  const outbox = useOutbox();
  const [confirm, setConfirm] = useState<UnsentChanges | null>(null);
  const close = () => setConfirm(null);
  // v2 pos/cart/clear-local-data.tsx: clear on the next load, so no database is removed under open providers.
  function clear() {
    close();
    if (schedule()) reload();
    else toast({ title: 'Could not clear local data. Close the app completely, open it again, and retry.', type: 'error' });
  }
  return <>
    <View testID="settings-general-clear-local-data-zone" className={wide
      ? 'mt-2 flex-row items-center justify-between gap-3 border-t border-border pt-4'
      : 'mt-2 gap-3 border-t border-border pt-4'}>
      <Text testID="settings-general-clear-local-data-body" className={wide ? `${SETTINGS_HELP_CLASS} max-w-96 flex-1` : SETTINGS_HELP_CLASS}>
        Everything stored on this device is deleted and downloaded again from your server.
      </Text>
      <Button testID="settings-general-clear-local-data" variant="outline" className="h-11 border-destructive"
        onPress={() => setConfirm(unsentChanges(outbox))}><Text>Clear All Local Data</Text></Button>
    </View>
    {confirm !== null && <AlertDialog open onOpenChange={next => { if (!next) close(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear all local data?</AlertDialogTitle>
          <AlertDialogDescription testID="clear-all-local-data-description">{describeResetConfirm(confirm)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild onPress={close}>
            <Button variant="outline" testID="clear-all-local-data-cancel"><Text>Cancel</Text></Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild onPress={clear}>
            <Button variant="destructive" testID="clear-all-local-data-confirm"><Text>Clear all local data</Text></Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>}
  </>;
}
