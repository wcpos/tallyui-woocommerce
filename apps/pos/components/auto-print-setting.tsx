import type { JSX } from 'react';
import { View } from 'react-native';
import { Text } from '@tallyui/components';
import { useReceiptSettings } from '../lib/receipts/receipt-settings';
import { SwitchRow } from './select-chevron';

// v2's pos-cart autoShowReceipt and autoPrintReceipt (Cart Settings, ui-settings-form.tsx): two plain FormSwitch
// rows in the form's list, the switch then its label, with no group round them.
// As in v2, the print dialog hint shows only when auto print is on and auto show is off (FormSwitch's description).
export function AutoPrintReceiptSetting(): JSX.Element {
  const [settings, update] = useReceiptSettings();
  return <>
    <SwitchRow label="Automatically show receipt after checkout" testID="cart-setting-auto-show-receipt"
      accessibilityLabel="Automatically show receipt after checkout" checked={settings.autoShow}
      onCheckedChange={autoShow => update({ ...settings, autoShow })} />
    <View className="gap-1.5">
      <SwitchRow label="Automatically print receipt after checkout" testID="cart-setting-auto-print-receipt"
        accessibilityLabel="Automatically print receipt after checkout" checked={settings.autoPrint}
        onCheckedChange={autoPrint => update({ ...settings, autoPrint })} />
      {/* v2's FormDescription is `variant="help"` (form/common.tsx l.103): `text-muted-foreground text-xs`, 12 px (text/ladder.ts l.15). */}
      {settings.autoPrint && !settings.autoShow ? <Text testID="cart-setting-auto-print-hint" className="text-xs text-muted-foreground">
        Without a receipt printer, the print dialog opens after each sale.</Text> : null}
    </View>
  </>;
}
