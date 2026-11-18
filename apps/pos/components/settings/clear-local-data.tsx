import { useState, type JSX } from 'react';
import { View } from 'react-native';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Text,
} from '@tallyui/components';
import { checkLocalData, type LocalDataCheck } from '../../lib/local-data-check';
import { describeResetConfirm, scheduleLocalDataReset } from '../../lib/local-data-reset';
import { useIsWide } from '../../lib/layout/wide';
import { useOutbox } from '../../lib/sale/outbox-context';
import { toast } from '../../lib/toast/toast';
import { SETTINGS_HELP_CLASS } from './settings-form';

export function ClearLocalData({
  schedule = () => scheduleLocalDataReset(), reload = () => globalThis.location?.reload(), check,
}: { schedule?: () => boolean; reload?: () => void; check?: () => Promise<LocalDataCheck> }): JSX.Element {
  const wide = useIsWide();
  const outbox = useOutbox();
  const [confirm, setConfirm] = useState<LocalDataCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const close = () => setConfirm(null);
  const run = check ?? (() => checkLocalData({ active: outbox.enabled ? outbox.orders?.database ?? null : null }));
  async function start() {
    setChecking(true);
    try { setConfirm(await run()); } finally { setChecking(false); }
  }
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
        disabled={checking} onPress={() => { void start(); }}><Text>Clear All Local Data</Text></Button>
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
