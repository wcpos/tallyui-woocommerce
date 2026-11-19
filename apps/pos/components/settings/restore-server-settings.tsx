import { useState, type JSX } from 'react';
import { View } from 'react-native';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Text,
} from '@tallyui/components';
import { useIsWide } from '../../lib/layout/wide';
import { SavedMark, SETTINGS_HELP_CLASS, useMarkSaved } from './settings-form';

// v2 general.tsx:203-228 and :406-453: a danger zone, a destructive confirm, "Restored", or a failure with Try again.
export function RestoreServerSettings({ restore, onRestored }: { restore: () => void; onRestored?: () => void }): JSX.Element {
  const wide = useIsWide();
  const markSaved = useMarkSaved();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  function confirm() {
    setOpen(false);
    setFailed(false);
    try {
      restore();
      onRestored?.();
      markSaved(['restore']);
    } catch { setFailed(true); }
  }
  return <>
    {/* v2 settings-danger-zone.tsx:30-41, the shape ClearLocalData already draws. */}
    <View testID="settings-general-restore-server-zone" className={wide
      ? 'mt-2 flex-row items-center justify-between gap-3 border-t border-border pt-4'
      : 'mt-2 gap-3 border-t border-border pt-4'}>
      <Text testID="settings-general-restore-server-body" className={wide ? `${SETTINGS_HELP_CLASS} max-w-96 flex-1` : SETTINGS_HELP_CLASS}>
        Copied from your WooCommerce store; restoring overwrites local changes.
      </Text>
      <Button testID="settings-general-restore-server" variant="outline" className="h-11 border-destructive"
        onPress={() => setOpen(true)}><Text>Restore server settings</Text></Button>
    </View>
    <SavedMark name="restore" label="Restored" />
    {failed && <View className="gap-2">
      <Text testID="settings-general-restore-failed" className={SETTINGS_HELP_CLASS}>Couldn't reach the store</Text>
      <Button testID="settings-general-restore-retry" onPress={() => setOpen(true)}><Text>Try again</Text></Button>
    </View>}
    {open && <AlertDialog open onOpenChange={next => { if (!next) setOpen(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore server settings?</AlertDialogTitle>
          <AlertDialogDescription testID="settings-general-restore-description">
            These settings were copied from your WooCommerce store. Restoring will overwrite local changes with the server’s values.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild onPress={() => setOpen(false)}>
            <Button variant="outline" testID="settings-general-restore-cancel"><Text>Cancel</Text></Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild onPress={confirm}>
            <Button variant="destructive" testID="settings-general-restore-confirm"><Text>Restore server settings</Text></Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>}
  </>;
}
