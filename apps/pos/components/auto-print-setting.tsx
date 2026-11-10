import type { JSX } from 'react';
import { SettingsGroup, SettingsRow, Switch, Text } from '@tallyui/components';
import { useReceiptSettings } from '../lib/receipts/receipt-settings';

// v2's pos-cart autoShowReceipt and autoPrintReceipt (Cart Settings, ui-settings-form.tsx).
// As in v2, the print dialog hint shows only when auto print is on and auto show is off.
export function AutoPrintReceiptSetting(): JSX.Element {
  const [settings, update] = useReceiptSettings();
  return (
    <SettingsGroup title="Receipt">
      <SettingsRow label="Automatically show receipt after checkout" action={<Switch
        testID="cart-setting-auto-show-receipt" accessibilityLabel="Automatically show receipt after checkout"
        checked={settings.autoShow} onCheckedChange={autoShow => update({ ...settings, autoShow })} />} />
      <SettingsRow label="Automatically print receipt after checkout" action={<Switch
        testID="cart-setting-auto-print-receipt" accessibilityLabel="Automatically print receipt after checkout"
        checked={settings.autoPrint} onCheckedChange={autoPrint => update({ ...settings, autoPrint })} />} />
      {settings.autoPrint && !settings.autoShow ? <Text testID="cart-setting-auto-print-hint" className="text-sm text-muted-foreground">
        Without a receipt printer, the print dialog opens after each sale.</Text> : null}
    </SettingsGroup>
  );
}
