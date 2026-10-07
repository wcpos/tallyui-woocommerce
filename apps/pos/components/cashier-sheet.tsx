import { useState } from 'react';
import type { JSX } from 'react';
import { View } from 'react-native';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Text } from '@tallyui/components';

export interface CashierOption { uuid: string; name: string }
export function CashierSheet(props: {
  name: string;
  cashiers: CashierOption[];
  blockedReason?: string;
  onSwitch(uuid: string): void;
  onRemove?(uuid: string): void;
  onAddAnother(): void;
  onSignOut(): void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<CashierOption | null>(null);
  return <>
    <Button testID="register-bar-avatar" disabled={Boolean(props.blockedReason)} onPress={() => setOpen(true)}><Text>{`Cashier: ${props.name}`}</Text></Button>
    {props.blockedReason && <Text>{props.blockedReason}</Text>}
    {open && <Dialog open onOpenChange={setOpen}>
      <DialogContent testID="user-sheet">
        <DialogHeader><DialogTitle>{props.name}</DialogTitle></DialogHeader>
        {props.cashiers.map(cashier => <View key={cashier.uuid} className="flex-row gap-2">
          <Button testID={`user-sheet-user-${cashier.uuid}`}
            onPress={() => { setOpen(false); props.onSwitch(cashier.uuid); }}><Text>{`Switch to ${cashier.name}`}</Text></Button>
          {props.onRemove && <Button testID={`user-sheet-remove-${cashier.uuid}`} accessibilityLabel={`Remove ${cashier.name}`}
            onPress={() => setRemoving(cashier)}><Text>Remove</Text></Button>}
        </View>)}
        <DialogFooter>
          <Button testID="user-sheet-another-account" onPress={() => { setOpen(false); props.onAddAnother(); }}><Text>Another account</Text></Button>
          <Button testID="user-sheet-sign-out" onPress={() => { setOpen(false); props.onSignOut(); }}><Text>Sign out</Text></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>}
    {removing && <AlertDialog open onOpenChange={next => { if (!next) setRemoving(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Remove ${removing.name}`}</AlertDialogTitle>
          <AlertDialogDescription>Are you sure you want to remove this user? Removing a user from the POS will not affect any data on the server.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild onPress={() => setRemoving(null)}>
            <Button variant="outline" testID="user-sheet-remove-cancel"><Text>Cancel</Text></Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild onPress={() => { props.onRemove?.(removing.uuid); setRemoving(null); }}>
            <Button variant="destructive" testID="user-sheet-remove-confirm"><Text>Remove</Text></Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>}
  </>;
}
