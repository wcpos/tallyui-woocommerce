import type { JSX } from 'react';
import { SettingsGroup, SettingsRow, Switch, Text } from '@tallyui/components';
import { useReceiptSettings } from '../lib/receipts/receipt-settings';

// v2's pos-cart autoPrintReceipt (Cart Settings). v2 shows the hint when auto show is off; this app has no auto show.
export function AutoPrintReceiptSetting(): JSX.Element {
  const [settings, update] = useReceiptSettings();
  return (
    <SettingsGroup title="Receipt">
      <SettingsRow label="Automatically print receipt after checkout" action={<Switch
        testID="cart-setting-auto-print-receipt" accessibilityLabel="Automatically print receipt after checkout"
        checked={settings.autoPrint} onCheckedChange={autoPrint => update({ autoPrint })} />} />
      {settings.autoPrint ? <Text testID="cart-setting-auto-print-hint" className="text-sm text-muted-foreground">
        Without a receipt printer, the print dialog opens after each sale.</Text> : null}
    </SettingsGroup>
  );
}
