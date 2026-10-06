import { useState } from 'react';
import type { JSX } from 'react';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Text } from '@tallyui/components';

export interface CashierOption { uuid: string; name: string }
export function CashierSheet(props: {
  name: string;
  cashiers: CashierOption[];
  blockedReason?: string;
  onSwitch(uuid: string): void;
  onAddAnother(): void;
  onSignOut(): void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  return <>
    <Button testID="register-bar-avatar" disabled={Boolean(props.blockedReason)} onPress={() => setOpen(true)}><Text>{`Cashier: ${props.name}`}</Text></Button>
    {props.blockedReason && <Text>{props.blockedReason}</Text>}
    {open && <Dialog open onOpenChange={setOpen}>
      <DialogContent testID="user-sheet">
        <DialogHeader><DialogTitle>{props.name}</DialogTitle></DialogHeader>
        {props.cashiers.map(cashier => <Button key={cashier.uuid} testID={`user-sheet-user-${cashier.uuid}`}
          onPress={() => { setOpen(false); props.onSwitch(cashier.uuid); }}><Text>{`Switch to ${cashier.name}`}</Text></Button>)}
        <DialogFooter>
          <Button testID="user-sheet-another-account" onPress={() => { setOpen(false); props.onAddAnother(); }}><Text>Another account</Text></Button>
          <Button testID="user-sheet-sign-out" onPress={() => { setOpen(false); props.onSignOut(); }}><Text>Sign out</Text></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>}
  </>;
}
